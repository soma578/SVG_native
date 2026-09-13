import assert from "node:assert/strict";
import test from "node:test";

import { CsvMapper } from "./CsvMapper.js";
import {
	buildExternalCsvPhotoPopup,
	buildGoogleDriveImageUrl,
	buildGoogleDriveProxyUrl,
	getSafeImageUrl,
	isExternalCsvPhotoPopupEnabled,
	parseGoogleDriveFileUrl
} from "./externalCsvPhotoPopup.js";

class FakeElement {
	constructor(tagName) {
		this.tagName = tagName.toUpperCase();
		this.nodeType = 1;
		this.attributes = new Map();
		this.childNodes = [];
		this.children = this.childNodes;
		this.parentElement = null;
		this.style = {};
		this.textContent = "";
		this.hidden = false;
		this.listeners = new Map();
	}

	setAttribute(name, value) {
		this.attributes.set(name, String(value));
	}

	getAttribute(name) {
		return this.attributes.get(name) ?? null;
	}

	appendChild(child) {
		child.parentElement = this;
		this.childNodes.push(child);
		return child;
	}

	removeChild(child) {
		this.childNodes.splice(this.childNodes.indexOf(child), 1);
	}

	addEventListener(name, callback) {
		this.listeners.set(name, callback);
	}

	dispatch(name) {
		this.listeners.get(name)?.();
	}
}

class FakeDocument {
	constructor() {
		this.documentElement = new FakeElement("svg");
		this.firstChild = this.documentElement;
		this.defs = new FakeElement("defs");
		const icon = new FakeElement("g");
		icon.setAttribute("id", "p0");
		this.defs.appendChild(icon);
		this.documentElement.appendChild(this.defs);
	}

	createElement(tagName) {
		return new FakeElement(tagName);
	}

	getElementsByTagName(tagName) {
		const wanted = tagName.toUpperCase();
		const found = [];
		const visit = (element) => {
			if (element.tagName === wanted) found.push(element);
			element.childNodes.forEach(visit);
		};
		visit(this.documentElement);
		return found;
	}

	getElementById(id) {
		return this.getElementsByTagName("g").find((element) => element.getAttribute("id") === id) || null;
	}
}

function collectTags(root) {
	return [root.tagName, ...root.childNodes.flatMap(collectTags)];
}

test("photo popup mode is opt-in for only the configured CSV layer", () => {
	assert.equal(isExternalCsvPhotoPopupEnabled({ Path: "csvXhr_r20.svg#popup=externalCsvPhoto" }), true);
	assert.equal(isExternalCsvPhotoPopupEnabled({ Path: "csvXhr_r20.svg#latCol=2" }), false);
});

test("image URLs accept HTTPS and reject executable schemes", () => {
	assert.equal(
		getSafeImageUrl("https://example.com/photo.jpg", "https://map.example/"),
		"https://example.com/photo.jpg"
	);
	assert.equal(getSafeImageUrl("javascript:alert(1)", "https://map.example/"), null);
	assert.equal(getSafeImageUrl("data:text/html,<script>alert(1)</script>", "https://map.example/"), null);
	assert.equal(getSafeImageUrl("", "https://map.example/"), null);
	assert.equal(getSafeImageUrl("http://example.com/photo.jpg", "https://map.example/"), null);
	assert.equal(getSafeImageUrl("https://drive.google.com.example.com/file/d/ABC123/view", "https://map.example/"), null);
	assert.equal(
		getSafeImageUrl("http://example.com/photo.jpg", "http://localhost:8000/", true),
		"http://example.com/photo.jpg"
	);
});

test("Google Drive sharing URLs produce a file id and preserve resourceKey", () => {
	assert.deepEqual(parseGoogleDriveFileUrl("https://drive.google.com/file/d/ABC123/view"), {
		fileId: "ABC123",
		resourceKey: null,
		shareUrl: "https://drive.google.com/file/d/ABC123/view"
	});
	assert.deepEqual(parseGoogleDriveFileUrl("https://drive.google.com/file/d/ABC123/view?usp=sharing&resourcekey=RK_456"), {
		fileId: "ABC123",
		resourceKey: "RK_456",
		shareUrl: "https://drive.google.com/file/d/ABC123/view?usp=sharing&resourcekey=RK_456"
	});
	assert.equal(parseGoogleDriveFileUrl("https://drive.google.com/open?id=ABC123").fileId, "ABC123");
	assert.equal(parseGoogleDriveFileUrl("https://drive.google.com.example.com/file/d/ABC123/view"), null);
	assert.equal(
		buildGoogleDriveImageUrl({ fileId: "ABC123", resourceKey: "RK_456" }),
		"https://drive.google.com/thumbnail?id=ABC123&sz=w1600&resourcekey=RK_456"
	);
	assert.equal(
		buildGoogleDriveProxyUrl({ fileId: "ABC123", resourceKey: "RK_456" }, "http://localhost:3000/map"),
		"http://localhost:3000/api/drive-image?id=ABC123&resourcekey=RK_456"
	);
});

test("popup treats CSV title and description as text", () => {
	const doc = new FakeDocument();
	const popup = buildExternalCsvPhotoPopup(doc, {
		title: "<img src=x onerror=alert(1)>",
		imageUrl: "javascript:alert(1)",
		description: "<script>alert(1)</script>",
		fields: [{ name: "id", value: "<b>001</b>" }]
	}, { baseUrl: "https://map.example/", allowHttp: false });

	assert.equal(popup.childNodes[0].textContent, "<img src=x onerror=alert(1)>");
	assert.deepEqual(collectTags(popup).filter((tag) => tag === "IMG" || tag === "SCRIPT" || tag === "B"), []);
});

test("popup includes a constrained image only when imageUrl is valid", () => {
	const doc = new FakeDocument();
	const popup = buildExternalCsvPhotoPopup(doc, {
		title: "地点A",
		imageUrl: "https://example.com/images/001.jpg",
		description: "地点Aの説明",
		fields: []
	}, { baseUrl: "https://map.example/", allowHttp: false });
	const image = popup.childNodes[1].childNodes[0];

	assert.equal(image.tagName, "IMG");
	assert.equal(image.src, "https://example.com/images/001.jpg");
	assert.equal(image.style.maxWidth, "100%");
	assert.equal(image.style.maxHeight, "360px");
	assert.equal(image.style.objectFit, "contain");
	assert.equal(popup.childNodes[2].textContent, "地点Aの説明");
});

test("Drive image failure hides the image and reveals a safe sharing link", () => {
	const doc = new FakeDocument();
	const popup = buildExternalCsvPhotoPopup(doc, {
		title: "地点A",
		imageUrl: "https://drive.google.com/file/d/ABC123/view?usp=sharing&resourcekey=RK_456",
		description: "地点Aの説明",
		fields: []
	}, { baseUrl: "https://map.example/", allowHttp: false });
	const figure = popup.childNodes[1];
	const image = figure.childNodes[0];
	const fallback = figure.childNodes[1];
	const link = fallback.childNodes[1];

	assert.equal(image.src, "https://map.example/api/drive-image?id=ABC123&resourcekey=RK_456");
	assert.equal(fallback.hidden, true);
	image.dispatch("error");
	assert.equal(image.src, "https://drive.google.com/thumbnail?id=ABC123&sz=w1600&resourcekey=RK_456");
	assert.equal(fallback.hidden, true);
	image.dispatch("error");
	assert.equal(image.hidden, true);
	assert.equal(image.style.display, "none");
	assert.equal(fallback.hidden, false);
	assert.equal(link.textContent, "Google Driveで写真を開く");
	assert.equal(link.href, "https://drive.google.com/file/d/ABC123/view?usp=sharing&resourcekey=RK_456");
	assert.equal(link.target, "_blank");
	assert.equal(link.rel, "noopener noreferrer");
});

test("CsvMapper fetches the Sheet export URL and creates POIs with existing mapping", async () => {
	const originalWindow = globalThis.window;
	const originalDocument = globalThis.document;
	const originalXhr = globalThis.XMLHttpRequest;
	const svgImage = new FakeDocument();
	const requestedUrls = [];
	const csv = [
		"id,title,lat,lon,imageUrl,description",
		"001,地点A,34.6651,133.9180,https://example.com/images/001.jpg,地点Aの説明",
		"002,地点B,34.6702,133.9251,,地点Bの説明"
	].join("\n");

	class FakeXMLHttpRequest {
		open(_method, url) {
			this.url = url;
		}

		send() {
			requestedUrls.push(this.url);
			setTimeout(() => {
				this.readyState = 4;
				this.status = 200;
				this.responseText = csv;
				this.onreadystatechange();
			}, 0);
		}
	}

	try {
		globalThis.window = { parent: { location: { href: "https://map.example/index.html" } } };
		globalThis.document = { addEventListener() {} };
		globalThis.XMLHttpRequest = FakeXMLHttpRequest;
		const svgMap = { refreshScreen() {} };
		const mapper = new CsvMapper({
			svgMap,
			svgImage,
			svgImageProps: {
				script: {
					src: "https://map.example/csvUI_r20.html",
					location: {
						hash: "#csvPath=https://docs.google.com/spreadsheets/d/1RR_LtusyFPtp4Ut09Qc2Aoe92-Ocv4Dn1NZH73JOmcA/export?format=csv&latCol=2&lngCol=3&titleCol=1",
						pathname: "/csvUI_r20.html"
					}
				}
			},
			layerID: "external-csv-photo-layer"
		});
		mapper.onload();
		await new Promise((resolve) => setTimeout(resolve, 30));

		assert.deepEqual(requestedUrls, ["https://docs.google.com/spreadsheets/d/1RR_LtusyFPtp4Ut09Qc2Aoe92-Ocv4Dn1NZH73JOmcA/export?format=csv"]);
		const pois = svgImage.getElementsByTagName("use");
		assert.equal(pois.length, 2);
		assert.equal(pois[0].getAttribute("xlink:title"), "地点A");
		assert.equal(pois[0].getAttribute("xlink:href"), "#p0");
		assert.equal(pois[0].getAttribute("transform"), "ref(svg,13391.800000000001,-3466.51)");
		assert.equal(pois[0].getAttribute("content"), "001,地点A,34.6651,133.9180,https://example.com/images/001.jpg,地点Aの説明");
		assert.equal(svgImage.documentElement.getAttribute("property"), "id,title,lat,lon,imageUrl,description");
	} finally {
		globalThis.window = originalWindow;
		globalThis.document = originalDocument;
		globalThis.XMLHttpRequest = originalXhr;
	}
});
