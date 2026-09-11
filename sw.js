// 生成物。scripts/generate-upstream-sw.mjs が作る。手で編集しない。
// shell c56cf14f6764: 281 assets, 2.4 MiB
const SHELL_CACHE = 'svgmap-shell-c56cf14f6764';
const RUNTIME_CACHE = 'svgmap-runtime-v1';
const RUNTIME_MAX_BYTES = 209715200;
const SHELL = [
  "/index.html",
  "/svgmapAppLayers/Container.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/data/municipalities-index.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/current-location-pin.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/river-level-advisory.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/river-level-danger.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/river-level-evacuation.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/river-level-normal.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/river-level-stale.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/river-level-unknown.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/river-webcam.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/road-closure-cleared.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/road-closure-closed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/road-closure-flooded.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/road-closure-restricted.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/road-closure-unknown.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/shelter-closed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/shelter-default.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/shelter-full.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/shelter-limited.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/shelter-open.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/team-active.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/team-attention.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/team-completed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/team-planned.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/icons/team-standby.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/evacuation/evacuationDetail.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/evacuation/evacuationLayer.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/evacuation/evacuationLayer.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/evacuation/layer.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/portable-network/runtime.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/portable-network/safeFetch.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/densityPointFormat.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/mapMessages.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/observationFreshness.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/pinLayerProfiles.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/propertyModal.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/qtctFeatureEngine.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/representativePinsCore.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/representativePinsPortable.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/representativePinsPortable.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/runtime.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/representative-pins/runtimeCache.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/svgmap-slawa-client/InterWindowMessaging.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/svgmap-slawa-client/libs/SvgMapElementType.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/svgmap-slawa-client/libs/TransformLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/svgmap-slawa-client/libs/UtilFuncs.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/svgmap-slawa-client/runtime.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/svgmap-slawa-client/svgMapLayerLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/evacuation/map/layers/portable/svgmap-slawa-client/svgMapSandboxLayerLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/flood-warning/floodWarningDetail.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/flood-warning/floodWarningLayer.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/flood-warning/floodWarningLayer.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/flood-warning/floodWarningLayer.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/flood-warning/jmaWarnings.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/flood-warning/layer.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/flood-warning/warning-advisory.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/flood-warning/warning-emergency.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/flood-warning/warning-unknown.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/flood-warning/warning-warning.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/hazard/hazardLayer.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/hazard/hazardLayer.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/hazard/index.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/current-location-pin.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/river-level-advisory.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/river-level-danger.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/river-level-evacuation.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/river-level-normal.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/river-level-stale.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/river-level-unknown.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/river-webcam.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/road-closure-cleared.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/road-closure-closed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/road-closure-flooded.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/road-closure-restricted.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/road-closure-unknown.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/shelter-closed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/shelter-default.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/shelter-full.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/shelter-limited.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/shelter-open.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/team-active.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/team-attention.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/team-completed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/team-planned.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/icons/team-standby.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/current-location-pin.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/river-level-advisory.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/river-level-danger.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/river-level-evacuation.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/river-level-normal.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/river-level-stale.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/river-level-unknown.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/river-webcam.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/road-closure-cleared.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/road-closure-closed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/road-closure-flooded.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/road-closure-restricted.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/road-closure-unknown.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/shelter-closed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/shelter-default.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/shelter-full.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/shelter-limited.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/shelter-open.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/team-active.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/team-attention.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/team-completed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/team-planned.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/icons/team-standby.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/japan-river-webcams/layer.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/japan-river-webcams/webcam-runtime-policy.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/japan-river-webcams/webcamDetail.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/japan-river-webcams/webcamLayer.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/japan-river-webcams/webcamLayer.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/densityPointFormat.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/mapMessages.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/observationFreshness.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/pinLayerProfiles.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/propertyModal.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/qtctFeatureEngine.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/representativePinsCore.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/representativePinsPortable.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/representativePinsPortable.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/runtime.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/representative-pins/runtimeCache.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/svgmap-slawa-client/InterWindowMessaging.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/svgmap-slawa-client/libs/SvgMapElementType.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/svgmap-slawa-client/libs/TransformLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/svgmap-slawa-client/libs/UtilFuncs.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/svgmap-slawa-client/runtime.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/svgmap-slawa-client/svgMapLayerLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/svgmap-slawa-client/svgMapSandboxLayerLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/portable-network/runtime.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/portable-network/safeFetch.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/densityPointFormat.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/mapMessages.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/observationFreshness.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/pinLayerProfiles.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/propertyModal.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/qtctFeatureEngine.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/representativePinsCore.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/representativePinsPortable.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/representativePinsPortable.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/runtime.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/representative-pins/runtimeCache.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/svgmap-slawa-client/InterWindowMessaging.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/svgmap-slawa-client/libs/SvgMapElementType.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/svgmap-slawa-client/libs/TransformLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/svgmap-slawa-client/libs/UtilFuncs.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/svgmap-slawa-client/runtime.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/svgmap-slawa-client/svgMapLayerLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/svgmap-slawa-client/svgMapSandboxLayerLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/current-location-pin.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/river-level-advisory.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/river-level-danger.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/river-level-evacuation.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/river-level-normal.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/river-level-stale.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/river-level-unknown.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/river-webcam.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/road-closure-cleared.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/road-closure-closed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/road-closure-flooded.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/road-closure-restricted.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/road-closure-unknown.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/shelter-closed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/shelter-default.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/shelter-full.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/shelter-limited.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/shelter-open.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/team-active.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/team-attention.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/team-completed.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/team-planned.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/icons/team-standby.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/densityPointFormat.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/mapMessages.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/observationFreshness.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/pinLayerProfiles.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/propertyModal.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/qtctFeatureEngine.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/representativePinsCore.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/representativePinsPortable.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/representativePinsPortable.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/runtime.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/representative-pins/runtimeCache.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/svgmap-slawa-client/InterWindowMessaging.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/svgmap-slawa-client/libs/SvgMapElementType.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/svgmap-slawa-client/libs/TransformLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/svgmap-slawa-client/libs/UtilFuncs.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/svgmap-slawa-client/runtime.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/svgmap-slawa-client/svgMapLayerLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/svgmap-slawa-client/svgMapSandboxLayerLib.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/appLayersAdmin.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/layer.package.json",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityAreaLayer.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityAreaLayer.svg",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityCsv.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityDetail.js",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityLayer.html",
  "/svgmapAppLayers/appLayers/svg3-bosai/team-activity/map/layers/portable/team-activity/teamActivityLayer.svg",
  "/svgmapjs/3D_extension/SVGMapLv0.1_CesiumWrapper_r4module.js",
  "/svgmapjs/3D_extension/cesiumWindow4.html",
  "/svgmapjs/3D_extension/cesiumWindow4_module.js",
  "/svgmapjs/3D_extension/getProviderViewModels_module.js",
  "/svgmapjs/CorsProxyModule.js",
  "/svgmapjs/InterWindowMessaging.js",
  "/svgmapjs/SVGMapCustomLayersManagerApp_r3module.js",
  "/svgmapjs/SVGMapCustomLayersManagerClient.js",
  "/svgmapjs/SVGMapCustomLayersManager_r3module.html",
  "/svgmapjs/SVGMapLv0.1_Authoring_r8_module.js",
  "/svgmapjs/SVGMapLv0.1_Class_r18module.js",
  "/svgmapjs/SVGMapLv0.1_CustomLayersManager_r3module.js",
  "/svgmapjs/SVGMapLv0.1_GIS_r4_module.js",
  "/svgmapjs/SVGMapLv0.1_LayerUI_r6module.js",
  "/svgmapjs/SVGMapLv0.1_r18module.js",
  "/svgmapjs/customLayerManagerExtension.js",
  "/svgmapjs/libs/BuiltinIcons.js",
  "/svgmapjs/libs/CollidedImagesGetter.js",
  "/svgmapjs/libs/CustomHitTester.js",
  "/svgmapjs/libs/CustomModal.js",
  "/svgmapjs/libs/EssentialUIs.js",
  "/svgmapjs/libs/GPS.js",
  "/svgmapjs/libs/GeometryCapture.js",
  "/svgmapjs/libs/GlobalMessageDisplay.js",
  "/svgmapjs/libs/HashGen.js",
  "/svgmapjs/libs/IframeAdapter4SLaWA.js",
  "/svgmapjs/libs/ImgRenderer.js",
  "/svgmapjs/libs/KMLParser.js",
  "/svgmapjs/libs/LayerManager.js",
  "/svgmapjs/libs/LayerSpecificWebAppHandler.js",
  "/svgmapjs/libs/LayerStyleCustomizer.js",
  "/svgmapjs/libs/LinkedDocOp.js",
  "/svgmapjs/libs/MapTicker.js",
  "/svgmapjs/libs/MapViewerProps.js",
  "/svgmapjs/libs/PathHitTester.js",
  "/svgmapjs/libs/PathRenderer.js",
  "/svgmapjs/libs/PoiHitTester.js",
  "/svgmapjs/libs/ProxyManager.js",
  "/svgmapjs/libs/ResourceLoadingObserver.js",
  "/svgmapjs/libs/ResumeManager.js",
  "/svgmapjs/libs/SVGMapSerializer_obsoluted.js",
  "/svgmapjs/libs/SVGMapVectorFileRenderer.js",
  "/svgmapjs/libs/SandboxWrapper.js",
  "/svgmapjs/libs/ShowPoiProperty.js",
  "/svgmapjs/libs/SvgImageProps.js",
  "/svgmapjs/libs/SvgMapElementType.js",
  "/svgmapjs/libs/SvgStyle.js",
  "/svgmapjs/libs/SvgStyleEditor.js",
  "/svgmapjs/libs/TernarySimultaneousEquationsSolution.js",
  "/svgmapjs/libs/TransformLib.js",
  "/svgmapjs/libs/UAtester.js",
  "/svgmapjs/libs/UtilFuncs.js",
  "/svgmapjs/libs/ZoomPanManager.js",
  "/svgmapjs/svgMapLayerLib.js",
  "/svgmapjs/svgMapSandboxLayerLib.js",
  "/svgmapjs/tests/unittest/EssentialUIs.test.js",
  "/svgmapjs/tests/unittest/GPS.test.js",
  "/svgmapjs/tests/unittest/GeoMetryCapture.test.js",
  "/svgmapjs/tests/unittest/MapTicker.test.js",
  "/svgmapjs/tests/unittest/PathHitTester.test.js",
  "/svgmapjs/tests/unittest/PathRenderer.test.js",
  "/svgmapjs/tests/unittest/PoiHitTester.test.js",
  "/svgmapjs/tests/unittest/ProxyManager.test.js",
  "/svgmapjs/tests/unittest/ResourceLoadingObserver.test.js",
  "/svgmapjs/tests/unittest/ResumeManager.test.js",
  "/svgmapjs/tests/unittest/SVGMapLv0.1_Class_r18module.test.js",
  "/svgmapjs/tests/unittest/SVGMapLv0.1_GIS.test.js",
  "/svgmapjs/tests/unittest/SandboxWrapper.test.js",
  "/svgmapjs/tests/unittest/ShowPoiProperty.test.js",
  "/svgmapjs/tests/unittest/SvgImageProps.test.js",
  "/svgmapjs/tests/unittest/SvgStyle.test.js",
  "/svgmapjs/tests/unittest/TernarySimultaneousEquationsSolution.test.js",
  "/svgmapjs/tests/unittest/TestResetUtility.js",
  "/svgmapjs/tests/unittest/TransformLib.test.js",
  "/svgmapjs/tests/unittest/UAtester.test.js",
  "/svgmapjs/tests/unittest/UtilFuncs.test.js",
  "/svgmapjs/tests/unittest/ZoomPanManager.test.js",
  "/svgmapjs/tests/unittest/resources/mock.html",
  "/svgmapjs/tests/unittest/resources/mockParamerters.js",
  "/svgmapjs/tests/unittest/svgMapSandboxLayerLib.test.js"
];

self.addEventListener('install', (event) => {
  // 1つ失敗しても起動一式が入らないより、入る分だけ入れて先へ進める。
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('svgmap-shell-') && name !== SHELL_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// 使った分だけ残す。上限を超えたら古い順に落とす。
const trimRuntime = async () => {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  let total = 0;
  const sized = [];
  for (const request of keys) {
    const response = await cache.match(request);
    const length = Number(response?.headers?.get('content-length') || 0);
    total += length;
    sized.push({ request, length });
  }
  if (total <= RUNTIME_MAX_BYTES) return;
  for (const entry of sized) {
    if (total <= RUNTIME_MAX_BYTES) break;
    await cache.delete(entry.request);
    total -= entry.length;
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 外部タイルには触らない

  event.respondWith((async () => {
    const shellHit = await caches.match(request, { cacheName: SHELL_CACHE });
    if (shellHit) return shellHit;
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        void trimRuntime();
      }
      return response;
    } catch (error) {
      // 通信が切れたら、保存済みがあればそれを返す。無ければそのまま失敗させる。
      const fallback = await cache.match(request);
      if (fallback) return fallback;
      throw error;
    }
  })());
});
