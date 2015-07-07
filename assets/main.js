var data_obj, numDatasets, layerOrdering, choropleths;

function getLayerCategoryLabel(category) {
    switch (category) {
        case "summary": return "Summaries";
        case "initiative": return "Place-based Initiatives";
        case "baseline": return "Baseline Information";
        default: return "Other Data Layers";
    }
}

function load_map_data (data_format) {
    //console.log(data_format);
    $.getJSON('data/datasets.json', function(datasets) {
        data_obj = datasets;
        numDatasets = datasetCount();
        layerOrdering = [];
        for (var k in data_obj) {
            if (data_obj.hasOwnProperty(k)) {
                layerOrdering[parseInt(data_obj[k]["layerOrder"],10)-1] = k;
            }
        }
        // console.log(numDatasets);
        // console.log(layerOrdering);

        var i;
        // Load each program and add it as an overlay layer to control
        switch (data_format) {
            case "geojson":
                for (i = 0; i < numDatasets; i++) {
                    k = layerOrdering[i];
                    if (data_obj.hasOwnProperty(k)) {
                        load_geojson_location_data(k);
                    }
                }
                break;
            case "topojson":
                for (i = 0; i < numDatasets; i++) {
                    k = layerOrdering[i];
                    if (data_obj.hasOwnProperty(k)) {
                        load_topojson_location_data(k);
                    }
                }
                break;
            default: // load nothing
                break;
        }
    }, function(e) { map.spin(false); console.log(e); });
}

function load_geojson_location_data (dataset) {
    //console.log(dataset);
    if (!data_obj[dataset].hasOwnProperty("layer_data") || data_obj[dataset][layer_data] === undefined) {
        map.spin(true);
        $.getJSON(data_obj[dataset]["geojson"], function(data) {
            var layerGroup = L.layerGroup();
            var newLayer;
            data.features.forEach(function(feature) {
                newLayer = L.geoJson.css(feature);
                newLayer.setStyle(data_obj[dataset]["style"]);
                layerGroup.addLayer(newLayer);
            });
            data_obj[dataset]["layer_data"] = layerGroup;
            layerControl.addOverlay(data_obj[dataset]["layer_data"],
                getStyledInitiativeLabel(dataset, "legend"),
                getLayerCategoryLabel(data_obj[dataset]["category"]));
            data_obj[dataset]["layer_data"].addTo(map);
            createColorBoxCSS(dataset);
            overlayCount++;
            if (overlayCount === numDatasets) {
                reorderLayers();
                choropleths = getChoropleths();
                var baseLayersTitle = $("<div></div>")
                    .html("<h4 class=\"leaflet-control-layers-section-name\">Base Map Layers</h4>");
                baseLayersDiv.prepend(baseLayersTitle);
                var overlayLayersTitle = $("<div></div>")
                    .html("<h4 class=\"leaflet-control-layers-section-name\">Overlay Layers</h4>")
                    .append(buttonsDiv);
                overlaysDiv.prepend(overlayLayersTitle);
            }
            map.spin(false);
        }, function(e) { map.spin(false); console.log(e); });
    }
}

function load_topojson_location_data (dataset) {
    // console.log("Entered load_topojson_location_data("+dataset+")");
    // var popupTemplate = "<div class=\"colorbox colorbox-popup colorbox-"+dataset+"\"></div><strong>{InitiativeTitle}</strong><p>{LocationDisplay}</p>";
    if (!data_obj[dataset].hasOwnProperty("layer_data") || data_obj[dataset][layer_data] === undefined) {
        map.spin(true);
        var layer;
        $.getJSON(data_obj[dataset]["topojson"], function(data) {
            var layerGroup = L.featureGroup();
            var newLayer = new L.TopoJSON();
            newLayer.addData(data);
            if (data_obj[dataset]["type"] === "regions") {
                newLayer.setStyle(data_obj[dataset]["style"]);
                newLayer.on("mouseover", function(e) {
                    var targets = {};
                    getSummaryOverlays().map( function(summary) {
                        var poly = getPolygonsForPointInDataset(e.latlng, summary);
                        if (poly.length) { targets[summary] = poly[0]; }
                    });
                    for (var overlay in targets) {
                        if (targets.hasOwnProperty(overlay)) {
                            if (targets[overlay]) {
                                e.target = targets[overlay];
                                map.choroplethDisplay[overlay].update(e);
                            } else {
                                map.choroplethDisplay[overlay].reset();
                            }
                        }
                    }
                });
                newLayer.on("mouseout", function(e) {
                    getSummaryOverlays().forEach(function(overlay) {
                        map.choroplethDisplay[overlay].reset();
                    });
                });
                newLayer.on("click", displayPopup);
                layerGroup.addLayer(newLayer);
                data_obj[dataset]["layer_data"] = layerGroup;
                layerControl.addOverlay(data_obj[dataset]["layer_data"],
                    getStyledInitiativeLabel(dataset, "legend"),
                    getLayerCategoryLabel(data_obj[dataset]["category"]));
                createColorBoxCSS(dataset);
                if (data_obj[dataset]["displayed"]) {
                    data_obj[dataset]["layer_data"].addTo(map);
                }
            } else if (data_obj[dataset]["type"] === "choropleth") {
                if (data_obj[dataset]["category"] === "summary") {
                    map.summaryOverlays.push(dataset);
                }
                newLayer.setStyle(data_obj[dataset]["style"]);
                createChoroplethTools(dataset);
                //console.log("Created Choropleth Tools for "+dataset);
                for (layer in newLayer._layers) {
                    if (newLayer._layers.hasOwnProperty(layer)) {
                        //console.log(layer);
                        var theLayer = newLayer._layers[layer];
                        //console.log(theLayer);
                        var layerProps = theLayer.feature.properties;
                        var variable = parseInt(getChoroplethVariable(dataset, layerProps), 10);
                        var theColor = getColor(dataset, variable);
                        //console.log("theColor = "+theColor);
                        //console.log(theLayer.setStyle);
                        theLayer.setStyle({
                            "color": theColor
                        });
                        theLayer.on("mouseover", function(e) {
                            var targets = {};
                            getSummaryOverlays().map( function(summary) {
                                var poly = getPolygonsForPointInDataset(e.latlng, summary);
                                if (poly.length) { targets[summary] = poly[0]; }
                            });
                            for (var overlay in targets) {
                                if (targets.hasOwnProperty(overlay)) {
                                    if (targets[overlay]) {
                                        e.target = targets[overlay];
                                        map.choroplethDisplay[overlay].update(e);
                                    } else {
                                        map.choroplethDisplay[overlay].reset();
                                    }
                                }
                            }
                        });
                        theLayer.on("mouseout", function(e) {
                            getSummaryOverlays().forEach(function(overlay) {
                                map.choroplethDisplay[overlay].reset();
                            });
                        });
                        theLayer.on("click", displayPopup);
                    }
                }
                layerGroup.addLayer(newLayer);
                data_obj[dataset]["layer_data"] = layerGroup;
                layerControl.addOverlay(data_obj[dataset]["layer_data"],
                    getStyledChoroplethLabel(dataset, "legend"),
                    getLayerCategoryLabel(data_obj[dataset]["category"]));
                if (data_obj[dataset]["displayed"]) {
                    data_obj[dataset]["layer_data"].addTo(map);
                }
            }
            overlayCount++;
            if (overlayCount === numDatasets) {
                reorderLayers();
                choropleths = getChoropleths();
                var baseLayersTitle = $("<div  class=\"leaflet-control-layers-section-name\"></div>")
                    .html("<h4>Base Map Layers</h4>");
                baseLayersDiv.before(baseLayersTitle);
                var overlayLayersTitle = $("<div class=\"leaflet-control-layers-section-name\"></div>")
                    .html("<h4>Overlay Layers</h4>")
                    .append(buttonsDiv);
                overlaysDiv.before(overlayLayersTitle);
            }
            map.spin(false);
        }, function(e) { map.spin(false); console.log(e); });
    }
}

function getSummaryOverlays() {
    return map.summaryOverlays;
}

function getChoropleths() {
    return Object.keys(data_obj).map(function(dataset) {
        if (data_obj.hasOwnProperty(dataset)
            && data_obj[dataset]["type"] === "choropleth") {
            return data_obj[dataset]["layer_data"]
        }
    });
}

function createColorBoxCSS(dataset) {
    var rgb_color = hexToRgb(data_obj[dataset].style.color);
    var cssString = ".colorbox-" + dataset + " { background-color: rgba("
        + rgb_color.r + "," + rgb_color.g + "," + rgb_color.b + ","
        + data_obj[dataset]["style"]["fillOpacity"] + "); border-color: rgba("
        + rgb_color.r + "," + rgb_color.g + "," + rgb_color.b + ","
        + data_obj[dataset]["style"]["opacity"] + "); }";
    $("style#colorboxes").append(cssString);
}

function getStyledInitiativeLabel(dataset, where) {
    var colorBoxDiv = "<div class=\"colorbox colorbox-" + where +
        " colorbox-" + dataset + "\"></div>";
    var styledLabel = $("<span>");
    styledLabel.css("font-weight", "bold");
    styledLabel.text(data_obj[dataset]["label"]);
    return colorBoxDiv + styledLabel.prop("outerHTML");
}

function getChoroplethGradientBox(width, width_measure, height, height_measure, colors, where) {
    var colorBoxDiv = (where === undefined) ? "<div class=\"colorbox\"></div>" :
    "<div class=\"colorbox colorbox-"+where+"\"></div>";
    var aDiv;
    var gradientBox = $(colorBoxDiv);
    gradientBox.width(width.toString()+width_measure)
        .css("height", height.toString()+height_measure)
        .css("border-width","0px")
        .css("padding","0")
        .css("line-height", "0")
        .css("vertical-align","bottom");
    colors.forEach(function (col) {
        aDiv = $("<div></div>")
            .css("background-color", col)
            .css("border-width", "0px")
            .css("display", "inline-block")
            .css("height", "100%")
            .css("margin", "0")
            .css("padding", "0")
            .css("vertical-align","bottom")
            .width((100 / colors.length).toString()+"%");
        gradientBox.prepend(aDiv);
    });
    return gradientBox.prop("outerHTML");
}

function getStyledChoroplethLabel(dataset, where) {
    var gradientBox = getChoroplethGradientBox(40, "px", 10, "px", data_obj[dataset]["colors"], where);
    var styledLabel = $("<span>");
    styledLabel.css("font-weight", "bold");
    styledLabel.text(data_obj[dataset]["label"]);
    return gradientBox + styledLabel.prop("outerHTML");
}

function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function getColor(dataset, d) {
    var col = data_obj[dataset]["colors"];
    var thr = data_obj[dataset]["thresholds"];
    var cmap = {};
    for (var i = 0; i < col.length; i++) {
        if (i < thr.length) {
            cmap[thr[i].toString()] = col[i];
        } else {
            cmap["default"] = col[i];
        }
    }
    sorted_thr = thr.sort( function(a,b) { return b-a; } );
    for (var t in sorted_thr) {
        if (d > sorted_thr[t]) {
            var k = sorted_thr[t].toString();
            if (cmap.hasOwnProperty(k)) { return cmap[k]; }
        }
    }
    return cmap["default"];
}

function addAllLayers() {
    for (var i = 0; i < numDatasets; i++) {
        data_obj[layerOrdering[i]]["layer_data"].addTo(map);
    }
}

function removeAllLayers() {
    for (var k in data_obj) {
        map.removeLayer(data_obj[k]["layer_data"]);
    }
}

function datasetCount() {
    var n = 0;
    for (var k in data_obj) {
        if (data_obj.hasOwnProperty(k)) n++;
    }
    return n;
}

function reorderLayers() {
    for (var i = 0; i < numDatasets; i++) {
        if (map.hasLayer(data_obj[layerOrdering[i]]["layer_data"])) {
            data_obj[layerOrdering[i]]["layer_data"].bringToFront();
        }
    }
}

// Generate base map
var reverseGeocodeServiceUrl = "//nominatim.openstreetmap.org/reverse?format=json&accept-language=us-en";
var tftransport = L.tileLayer.provider("Thunderforest.Transport");
var tflandscape = L.tileLayer.provider("Thunderforest.Landscape");
var osm = L.tileLayer.provider("OpenStreetMap");
var stamenwc = L.tileLayer.provider("Stamen.Watercolor");
var base_layers = {
    "Thunderforest Transport": tftransport,
    "Thunderforest Landscape": tflandscape,
    "Open Street Map": osm,
    "Stamen Watercolor": stamenwc
};
for (bl in base_layers) { if (base_layers.hasOwnProperty(bl)) {
    base_layers[bl].options.attribution += " | powered by <a href=\"https://max.gov\" target=\"_blank\">MAX.gov</a>";
} }
var map = L.map('map', {
    click: displayPopup,
    scrollWheelZoom: false,
    zoomControl: false/*,
     doubleClickZoom: false */
}).setView([39.363415, -95.999397], 5);
map.summaryOverlays = [];

/*
 map.on("viewreset", function(e) { console.log("zoom: "+map.getZoom()+
 " | minZoom: "+map.getMinZoom()+" | maxZoom: "+map.getMaxZoom()); });
 */

// Create layers control and add base map to control
var overlay_groups = {};
overlay_groups[getLayerCategoryLabel("summary")] = {};
overlay_groups[getLayerCategoryLabel("initiative")] = {};
overlay_groups[getLayerCategoryLabel("baseline")] = {};
var layerControl = L.control.groupedLayers(base_layers, overlay_groups, { exclusiveGroups: [] });
layerControl.addTo(map);
base_layers["Open Street Map"].addTo(map);
// For accessibility
$("a.leaflet-control-layers-toggle").prop("title","Select Data Layers")
    .append("<span>Select Data Layers</span>");
// Add check all and uncheck all buttons to overlays selection
var overlaysDiv = $("div.leaflet-control-layers-overlays");
var baseLayersDiv = $("div.leaflet-control-layers-base");
var buttonsDiv = $("<div></div>").addClass("bulk-select-overlays");
var selectAllButton = "<button class=\"select-all-overlays\" type=\"button\" onclick=\"addAllLayers()\">Select All</button>";
var unselectAllButton = "<button class=\"unselect-all-overlays\" type=\"button\" onclick=\"removeAllLayers()\">Unselect All</button>";
buttonsDiv.html(selectAllButton+unselectAllButton);
// overlaysDiv.before(buttonsDiv);
var titleSpan = "<div><h3 class=\"leaflet-control-layers-title\"><span>Select Data Layers</span></h3></div>";
$("form.leaflet-control-layers-list").prepend($(titleSpan));
$(".leaflet-control-layers-toggle").on("mouseover", setLayerControlHeight)
    .on("focus", setLayerControlHeight)
    .on("touchstart",setLayerControlHeight);

function setLayerControlHeight(e) {
    var controlHeight = map.getSize().y-50;
    /*
     $(".leaflet-control-layers-expanded")
     .css("max-height",controlHeight.toString()+"px");
     */
    var cssString = ".leaflet-control-layers-expanded { max-height: "
        + controlHeight.toString() + "px; }";
    $("style#layercontrol").text(cssString);
}


// Add the display and legend for choropleth layers
map.choroplethLegend = {};
map.choroplethDisplay = {};

function getChoroplethVariableLabel (dataset, props) {
    var varlabels = data_obj[dataset].variable_label;
    if (varlabels instanceof Array) {
        return varlabels.map(function (k) {
            return props[k];
        }).join(", ");
    }
    return props[varlabels];
}

function getChoroplethVariable (dataset, props) {
    return props[data_obj[dataset]["variable"]];
}

function createChoroplethTools(dataset) {
    // console.log("Creating choroplethLegend["+dataset+"]");
    map.choroplethLegend[dataset] = L.control({"position":"bottomleft"});
    map.choroplethLegend[dataset].dataset = dataset;
    map.choroplethLegend[dataset].variable = function(p) {
        return getChoroplethVariable(dataset, p); };
    map.choroplethLegend[dataset].variable_label = function(p) {
        return getChoroplethVariableLabel(dataset, p); };
    map.choroplethLegend[dataset].onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'choropleth-legend choropleth-legend-'+this.dataset);
        this.update();
        return this._div;
    };
    map.choroplethLegend[dataset].update = function () {
        var legendString = "<strong>Legend: "+data_obj[this.dataset]["label"]+"</strong>";
        var colors = data_obj[this.dataset]["colors"];
        var thresholds = data_obj[this.dataset]["thresholds"];
        for (var i in thresholds) {
            if (i == 0) {
                legendString += "<div><div class=\"colorbox colorbox-popup\" style=\"background-color:"
                    +colors[i]+";border-color:"+colors[i]+";\"></div><span>"
                    +(thresholds[i]+1)+"+</span></div>";
            } else {
                legendString += "<div><div class=\"colorbox colorbox-popup\" style=\"background-color:"
                    +colors[i]+";border-color:"+colors[i]+";\"></div><span>"
                    +(thresholds[i]+1)+" - "+(thresholds[i-1])+"</span></div>";
            }
        }
        legendString += "<div><div class=\"colorbox colorbox-popup\" style=\"background-color:"
            +colors[colors.length-1]+";border-color:"+colors[colors.length-1]+";\"></div>"
            +"<span>1 - "+(thresholds[thresholds.length-1])+"</span></div>";
        $(this._div).html(legendString);
    };
    map.choroplethDisplay[dataset] = L.control({"position":"bottomleft"});
    map.choroplethDisplay[dataset].dataset = dataset;
    map.choroplethDisplay[dataset].variable = function(p) {
        return getChoroplethVariable(dataset, p); };
    map.choroplethDisplay[dataset].variable_label = function(p) {
        return getChoroplethVariableLabel(dataset, p); };
    map.choroplethDisplay[dataset].onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'choropleth-display');
        this.reset();
        return this._div;
    };
    map.choroplethDisplay[dataset].currentShape = null;
    map.choroplethDisplay[dataset].reset = function() {
        var hoverMessage = data_obj[dataset]["hover_instructions"] || "Hover over a region";
        $(this._div).html("<strong>"+hoverMessage+"</strong>");
    };
    map.choroplethDisplay[dataset].update = function (e) {
        //console.log("In map.choroplethDisplay["+dataset+"].update(e)...  e = ");
        //console.log(e);
        var props = e.target.feature.properties;
        //console.log(props);
        var cols = data_obj[dataset]["colors"];
        //console.log(this.variable_label(props));
        //console.log(this.variable(props));
        $(this._div).html("<div><div class=\"colorbox colorbox-popup\" style=\"background-color:"+
            getColor(this.dataset, Math.round(this.variable(props)))+
            "; width: 100%; margin: 0 auto; padding: 0; height: 25px;\">"+
            getChoroplethGradientBox(100, "%", 5, "px", cols, "info-gradient")+
            "</div><strong>"+ this.variable_label(props) +
            "</strong><p><strong style=\"font-size: 2.0em;\">"+
            Math.round(this.variable(props)) +"</strong> programs</p>");
    };
}

map.on("overlayadd", function(e) {
    for (var i = 0; i < numDatasets; i++) {
        var dataset = layerOrdering[i];
        if (data_obj.hasOwnProperty(dataset) && e.layer === data_obj[dataset]["layer_data"]) {
            if (data_obj[dataset]["type"] === "choropleth") {
                map.choroplethLegend[dataset].update();
                map.choroplethLegend[dataset].addTo(map);
                map.choroplethDisplay[dataset].reset();
                map.choroplethDisplay[dataset].addTo(map);
            }
        }
    }
    reorderLayers();
});
map.on("overlayremove", function(e) {
    for (var dataset in data_obj) {
        if (data_obj.hasOwnProperty(dataset) && e.layer === data_obj[dataset]["layer_data"]) {
            if (data_obj[dataset]["type"] === "choropleth") {
                map.removeControl(map.choroplethDisplay[dataset]);
                map.removeControl(map.choroplethLegend[dataset]);
            }
        }
    }
});

function getReverseGeolocationPromise(latlng) {
    var serviceRequestUrl = reverseGeocodeServiceUrl+"&lat="+latlng.lat+
        "&lon="+latlng.lng+"&zoom=12&addressdetails=1";
    return $.getJSON(serviceRequestUrl);
}

var overlayCount = 0;

// Add zoom, pan, scale and reset controls to the top left of map
/*
 var zooms = $("<div></div>", { id: "zoomcontrols" });
 var zoomHomeCtl = L.control.zoomHome({
 zoomHomeTitle: "Reset map view",
 homeCoordinates: [39.363415, -95.999397],
 homeZoom: 5
 });
 zoomHomeCtl.addTo(map);
 zoomHomeCtl._container.remove();
 zooms.append(zoomHomeCtl.onAdd(map));
 var zoomBoxCtl = L.control.zoomBox();
 zoomBoxCtl.addTo(map);
 zoomBoxCtl._container.remove();
 zooms.append(zoomBoxCtl.onAdd(map));
 */
new L.Control.zoomHome({
    zoomHomeTitle: "Reset map view",
    homeCoordinates: [39.363415, -95.999397],
    homeZoom: 5
}).addTo(map);
new L.Control.ZoomBox().addTo(map);

new L.Control.Pan({
    position: 'topleft'
}).addTo(map);

L.control.scale({ position: "topleft" }).addTo(map);


// Create a location search control and add to top right of map
new L.Control.GeoSearch({
    provider: new L.GeoSearch.Provider.OpenStreetMap(),
    position: 'topcenter',
    showMarker: false,
    retainZoomLevel: false
}).addTo(map);

// Create locate control and add to bottom right
/*
 L.control.locate({
 position: "bottomright",
 locateOptions: { maxZoom: 8 }
 }).addTo(map);
 // For accessibility
 $("div.leaflet-control-locate a.leaflet-bar-part.leaflet-bar-part-single")
 .prop("title", "Find My Location")
 .append("<span>Find My Location</span>");
 */

function getPolygonsForPoint(p) {
    var polygons = {};
    for (var dataset in data_obj) {
        if (data_obj.hasOwnProperty(dataset)) {
            polygons[dataset] = getPolygonsForPointInDataset(p, dataset);
        }
    }
    return polygons;
}

function getPolygonsForPointInDataset(p, dataset) {
    var polygons = {};
    if (data_obj.hasOwnProperty(dataset)) {
        polygons = [];
        data_obj[dataset].layer_data.eachLayer( function(l) {
            result = leafletPip.pointInLayer(p, l);
            //console.log(result);
            Array.prototype.push.apply(polygons, result);
        });
    }
    return polygons;
}

function getInitiativePopupSegment(dataset, polygons) {
    var popupString = "<div class=\"popup-segment\">" + getStyledInitiativeLabel(dataset, "popup");
    for (var poly in polygons) {
        if (polygons.hasOwnProperty(poly)) {
            popupString += "<p>" + polygons[poly].feature.properties.InitiativeTitle + " (" +
                polygons[poly].feature.properties.LocationDisplay + ")</p>";
        }
    }
    popupString += "</div>";
    return popupString;
}

function getSummaryPopupSegment(dataset, polygons, numPolygons) {
    var popupString = "<div class=\"popup-segment\">" + getStyledChoroplethLabel(dataset, "popup");
    for (var poly in polygons) {
        if (polygons.hasOwnProperty(poly)) {
            popupString += "<p><strong>" + numPolygons + "</strong> of " +
                Math.round(getChoroplethVariable(dataset, polygons[poly].feature.properties))+ " programs in " +
                getChoroplethVariableLabel(dataset, polygons[poly].feature.properties) + "</p>";
        }
    }
    popupString += "</div>";
    return popupString;
}

function displayPopup(e) {
    getReverseGeolocationPromise(e.latlng).done( function(data) {
        console.log(data);
        var location_string = "";
        var city, county, state;
        if (data.hasOwnProperty("address")) {
            if (data["address"].hasOwnProperty("city")) {
                city = data["address"]["city"].trim();
            }
            if (data["address"].hasOwnProperty("county")) {
                county = data["address"]["county"].trim();
            }
            if (data["address"].hasOwnProperty("state")) {
                state = data["address"]["state"].trim();
            }

            if (state && (state === "penna")) {
                state = "Pennsylvania";
            }
            if (city && (city === "NYC") && state && (state === "New York")) {
                city = "New York";
            }
            if (city && (city === "LA") && state && (state === "California")) {
                city = "Los Angeles";
            }
            if (city && (city === "SF") && state && (state === "California")) {
                city = "San Francisco";
            }
            if (city && ((city.slice(-4).toLowerCase() !== "city")
                || (city.slice(-8).toLowerCase() !==  "township"))) {
                city = "City of " + city;
            }
            if (city && (city.slice(-10).toLowerCase() === " (city of)")) {
                city = city.slice(0, city.length - 10);
            }
            if (city && state) {
                location_string = city + ", " + state;
            } else if (county && state) {
                location_string = county + ", " + state;
            } else if (state) {
                location_string = state + " (" + data["lat"]
                    + ", " + data["lon"] + ")";
            } else {
                location_string = "(" + data["lat"] + ", " + data["lon"] + ")";
            }
        } else {
            location_string = "(" + data["lat"] + ", " + data["lon"] + ")";
        }
        $("#popup_location_heading").text(location_string);
    }).error( function(err) {
        console.log("Reverse geolocation failed. Error:");
        console.log(err);
    });
    var popupString = "<h3 id=\"popup_location_heading\"></h3>";
    var popup = L.popup().setLatLng(e.latlng);
    var polys = getPolygonsForPoint(e.latlng);
    var numPolys = Object.keys(polys).map(function(dataset) {
        if (polys.hasOwnProperty(dataset) && data_obj[dataset].category === "initiative") {
            return polys[dataset].length;
        } return 0;
    }).reduce(function(prev, curr) { return prev + curr; });
    for (var i = 0; i < numDatasets; i++) {
        var dataset = layerOrdering[i];
        if (polys.hasOwnProperty(dataset) && polys[dataset].length) {
            if (data_obj[dataset].type !== "choropleth") {
                popupString += getInitiativePopupSegment(dataset, polys[dataset]);
            } else {
                popupString += getSummaryPopupSegment(dataset, polys[dataset], numPolys);
            }
        }
    }
    if (!popupString) { popupString = "No layers found."; }
    popup.setContent(popupString).openOn(map);
}
