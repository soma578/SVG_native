// External CSV photo popup extension for csvXhr_r20.svg.
// CSV loading and POI rendering remain the responsibility of CsvMapper.

const POPUP_MODE = "externalCsvPhoto";
const GOOGLE_DRIVE_HOSTNAME = "drive.google.com";

function getLayerHash(svgImageProps) {
	if (typeof svgImageProps?.hash === "string" && svgImageProps.hash !== "") {
		return svgImageProps.hash.replace(/^#/, "");
	}
	const path = svgImageProps?.Path;
	if (typeof path === "string" && path.includes("#")) return path.substring(path.indexOf("#") + 1);
	return "";
}

export function isExternalCsvPhotoPopupEnabled(svgImageProps) {
	return new URLSearchParams(getLayerHash(svgImageProps)).get("popup") === POPUP_MODE;
}

// Optional, zero-based column mapping for CSVs whose photo/description headers
// differ from the original imageUrl/description names. The generic CSV parser
// and the property table retain their original behavior.
export function readExternalCsvPhotoFields(fields, svgImageProps) {
	const params = new URLSearchParams(getLayerHash(svgImageProps));
	const byName = new Map(fields.map((field) => [String(field.name).trim().toLowerCase(), field.value]));
	const valueFor = (parameter, defaultName) => {
		const column = params.get(parameter);
		if (column !== null && /^(0|[1-9]\d*)$/.test(column)) {
			const index = Number(column);
			if (index < fields.length) return fields[index].value || "";
		}
		return byName.get(defaultName) || "";
	};
	return {
		imageUrl: valueFor("imageCol", "imageurl"),
		description: valueFor("descriptionCol", "description")
	};
}

function isDevelopmentLocation(locationHref) {
	try {
		const hostname = new URL(locationHref).hostname;
		return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
	} catch (_error) {
		return false;
	}
}

export function getSafeImageUrl(rawUrl, baseUrl, allowHttp = false) {
	if (typeof rawUrl !== "string" || rawUrl.trim() === "") return null;
	try {
		const parsedUrl = new URL(rawUrl.trim(), baseUrl);
		// Drive sharing pages are never used directly as <img> sources. Look-alike
		// hostnames are also rejected instead of being treated as ordinary images.
		if (
			parsedUrl.hostname === GOOGLE_DRIVE_HOSTNAME ||
			parsedUrl.hostname.startsWith(`${GOOGLE_DRIVE_HOSTNAME}.`) ||
			parsedUrl.hostname.endsWith(`.${GOOGLE_DRIVE_HOSTNAME}`)
		) return null;
		if (parsedUrl.protocol === "https:") return parsedUrl.href;
		if (allowHttp && parsedUrl.protocol === "http:") return parsedUrl.href;
	} catch (_error) {
		// An invalid image URL is treated in the same way as a missing image.
	}
	return null;
}

export function parseGoogleDriveFileUrl(rawUrl) {
	if (typeof rawUrl !== "string" || rawUrl.trim() === "") return null;
	try {
		const parsedUrl = new URL(rawUrl.trim());
		if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== GOOGLE_DRIVE_HOSTNAME) return null;

		let fileId = null;
		const pathMatch = parsedUrl.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
		if (pathMatch) {
			fileId = pathMatch[1];
		} else if (parsedUrl.pathname === "/open") {
			fileId = parsedUrl.searchParams.get("id");
		}
		if (!fileId || !/^[A-Za-z0-9_-]+$/.test(fileId)) return null;

		return {
			fileId,
			resourceKey: parsedUrl.searchParams.get("resourcekey") || null,
			shareUrl: parsedUrl.href
		};
	} catch (_error) {
		return null;
	}
}

export function buildGoogleDriveImageUrl(driveFile) {
	if (!driveFile?.fileId) return null;
	const imageUrl = new URL("https://drive.google.com/thumbnail");
	imageUrl.searchParams.set("id", driveFile.fileId);
	imageUrl.searchParams.set("sz", "w1600");
	if (driveFile.resourceKey) imageUrl.searchParams.set("resourcekey", driveFile.resourceKey);
	return imageUrl.href;
}

export function buildGoogleDriveProxyUrl(driveFile, baseUrl) {
	if (!driveFile?.fileId || !baseUrl) return null;
	try {
		const imageUrl = new URL("/api/drive-image", baseUrl);
		imageUrl.searchParams.set("id", driveFile.fileId);
		if (driveFile.resourceKey) imageUrl.searchParams.set("resourcekey", driveFile.resourceKey);
		return imageUrl.href;
	} catch (_error) {
		return null;
	}
}

function getPrivateDrivePhotoSource(rawUrl, baseUrl) {
	try {
		const imageUrl = new URL(rawUrl, baseUrl);
		const base = new URL(baseUrl);
		if (imageUrl.origin !== base.origin || imageUrl.pathname !== "/api/private-sheet-image") return null;
		return parseGoogleDriveFileUrl(imageUrl.searchParams.get("source"));
	} catch (_error) {
		return null;
	}
}

function appendTextElement(doc, parent, tagName, text, styles = {}) {
	const element = doc.createElement(tagName);
	element.textContent = text;
	Object.assign(element.style, styles);
	parent.appendChild(element);
	return element;
}

export function buildExternalCsvPhotoPopup(doc, record, options = {}) {
	const root = doc.createElement("section");
	root.setAttribute("data-external-csv-photo-popup", "true");
	Object.assign(root.style, {
		boxSizing: "border-box",
		padding: "12px",
		fontFamily: "sans-serif",
		color: "#1f2937"
	});

	const title = record.title || "名称未設定";
	appendTextElement(doc, root, "h2", title, { margin: "0 0 12px", fontSize: "20px" });

	const privateDriveFile = getPrivateDrivePhotoSource(record.imageUrl, options.baseUrl);
	const driveFile = privateDriveFile || parseGoogleDriveFileUrl(record.imageUrl);
	const directDriveImageUrl = driveFile && !privateDriveFile ? buildGoogleDriveImageUrl(driveFile) : null;
	const safeImageUrl = privateDriveFile
		? getSafeImageUrl(record.imageUrl, options.baseUrl, options.allowHttp)
		: driveFile
		? (buildGoogleDriveProxyUrl(driveFile, options.baseUrl) || directDriveImageUrl)
		: getSafeImageUrl(record.imageUrl, options.baseUrl, options.allowHttp);
	if (safeImageUrl) {
		const figure = doc.createElement("figure");
		Object.assign(figure.style, { margin: "0 0 12px", textAlign: "center" });
		const image = doc.createElement("img");
		image.src = safeImageUrl;
		image.alt = title;
		Object.assign(image.style, {
			display: "block",
			maxWidth: "100%",
			maxHeight: "360px",
			width: "auto",
			height: "auto",
			margin: "0 auto",
			objectFit: "contain"
		});
		figure.appendChild(image);
		if (driveFile) {
			const retryUrls = directDriveImageUrl && directDriveImageUrl !== safeImageUrl
				? [directDriveImageUrl]
				: [];
			const fallback = doc.createElement("div");
			fallback.hidden = !options.showDriveFallbackInitially;
			Object.assign(fallback.style, { marginTop: "8px", lineHeight: "1.6" });
			appendTextElement(doc, fallback, "div", "画像を表示できません");
			const link = appendTextElement(doc, fallback, "a", "Google Driveで写真を開く");
			link.href = driveFile.shareUrl;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			figure.appendChild(fallback);
			image.addEventListener("error", () => {
				const retryUrl = retryUrls.shift();
				if (retryUrl) {
					image.src = retryUrl;
					return;
				}
				image.hidden = true;
				image.style.display = "none";
				fallback.hidden = false;
			});
		}
		root.appendChild(figure);
	}

	if (record.description) {
		appendTextElement(doc, root, "p", record.description, {
			margin: "0 0 12px",
			whiteSpace: "pre-wrap",
			lineHeight: "1.6"
		});
	}

	const details = doc.createElement("details");
	appendTextElement(doc, details, "summary", "CSV属性", { cursor: "pointer" });
	const table = doc.createElement("table");
	Object.assign(table.style, {
		width: "100%",
		marginTop: "8px",
		borderCollapse: "collapse",
		wordBreak: "break-word"
	});
	record.fields.forEach(({ name, value }) => {
		const row = doc.createElement("tr");
		const header = appendTextElement(doc, row, "th", name, {
			width: "30%",
			padding: "4px",
			border: "1px solid #d1d5db",
			textAlign: "left",
			verticalAlign: "top"
		});
		header.setAttribute("scope", "row");
		appendTextElement(doc, row, "td", value || "--", {
			padding: "4px",
			border: "1px solid #d1d5db",
			verticalAlign: "top"
		});
		table.appendChild(row);
	});
	details.appendChild(table);
	root.appendChild(details);
	return root;
}

export class ExternalCsvPhotoPopup {
	constructor() {
		window.addEventListener("layerWebAppReady", () => {
			if (!isExternalCsvPhotoPopupEnabled(window.svgImageProps)) return;
			// Other bundled CSV extensions also register during this event. Installing in a
			// microtask makes this opt-in handler the final handler for only this layer.
			queueMicrotask(() => {
				window.svgMap.setShowPoiProperty(this.showPoiProperty, window.layerID);
			});
		});
	}

	showPoiProperty = (target) => {
		const parseCsvLine = window.svgMap.parseEscapedCsvLine.bind(window.svgMap);
		const schemaText = target.ownerDocument.documentElement.getAttribute("property") || "";
		const contentText = target.getAttribute("content") || "";
		const schema = schemaText ? parseCsvLine(schemaText) : [];
		const values = contentText ? parseCsvLine(contentText) : [];
		const fields = values.map((value, index) => ({
			name: schema[index] || String(index),
			value
		}));
		const valueByName = new Map(fields.map((field) => [field.name.toLowerCase(), field.value]));
		const photoFields = readExternalCsvPhotoFields(fields, window.svgImageProps);
		const record = {
			title: target.getAttribute("data-title") || valueByName.get("title") || "",
			imageUrl: photoFields.imageUrl,
			description: photoFields.description,
			fields
		};
		let popupDocument = document;
		let canPassElement = false;
		try {
			if (window.parent.document?.createElement) {
				popupDocument = window.parent.document;
				canPassElement = true;
			}
		} catch (_error) {
			// S-LaWA can only send serialized content to the parent window.
		}
		const popup = buildExternalCsvPhotoPopup(popupDocument, record, {
			baseUrl: window.location.href,
			allowHttp: isDevelopmentLocation(window.location.href),
			showDriveFallbackInitially: !canPassElement
		});

		// Legacy LaWA accepts a DOM element and preserves the image error handler.
		// S-LaWA receives serialized markup; its Drive fallback is visible from the start.
		window.svgMap.showModal(canPassElement ? popup : popup.outerHTML, 480, 600);
		return true;
	};
}
