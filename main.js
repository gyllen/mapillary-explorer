/*jslint browser: true*/
/*global Tangram, gui */

var picking = false;
map = (function () {
// (function () {
    // 'use strict';

    var locations = {
        'Oakland': [37.8044, -122.2708, 15],
        'New York': [40.70531887544228, -74.00976419448853, 15],
        'Seattle': [47.5937, -122.3215, 15],
        'Malmö': [55.6060, 13.0010, 15]
    };

    var map_start_location = locations['Malmö'];

    /*** URL parsing ***/

    // leaflet-style URL hash pattern:
    // #[zoom],[lat],[lng]
    var url_hash = window.location.hash.slice(1, window.location.hash.length).split('/');
    keytext = "kind";
    window.keytext = keytext;
    valuetext = "none";
    window.valuetext = valuetext;

    if (url_hash.length >= 3) {
        map_start_location = [url_hash[1],url_hash[2], url_hash[0]];
        // convert from strings
        map_start_location = map_start_location.map(Number);
    }

    if (url_hash.length == 5) {
        keytext = unescape(url_hash[3]);
        valuetext = unescape(url_hash[4]);
    }

    // Put current state on URL
    window.updateURL = function() {
        // if (picking) return;
        // console.log(window.location.hash);
        var map_latlng = map.getCenter();
        var url_options = [map.getZoom().toFixed(1), map_latlng.lat.toFixed(4), map_latlng.lng.toFixed(4), escape(keytext), escape(valuetext)];
        window.location.hash = url_options.join('/');
    }

    /*** Map ***/

    var map = L.map('map',
        {"keyboardZoomOffset" : .05}
    );

    var layer = Tangram.leafletLayer({
        scene: 'scene.yaml',
        numWorkers: 2,
        attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>',
        unloadInvisibleTiles: false,
        updateWhenIdle: false
    });

    window.layer = layer;
    var scene = layer.scene;
    window.scene = scene;

    // setView expects format ([lat, long], zoom)
    map.setView(map_start_location.slice(0, 3), map_start_location[2]);
    map.on('moveend', updateURL);

    // var hash = new L.Hash(map);

    function updateKey(value) {
        keytext = value;

        for (layer in scene.config.layers) {
            // console.log(layer);
            if (layer == "earth") continue;
            scene.config.layers[layer].properties.key_text = value;
        }
        scene.rebuildGeometry();
        scene.requestRedraw();
        updateURL(); 
    }

    function updateValue(value) {
        valuetext = value;

        for (layer in scene.config.layers) {
            if (layer == "earth") continue;
            scene.config.layers[layer].properties.value_text = value;
        }
        scene.rebuildGeometry();
        scene.requestRedraw();
        updateURL();            
    }

    // Create dat GUI
    var gui = new dat.GUI({ autoPlace: true, hideable: false, width: 300 });
    function addGUI () {
        gui.domElement.parentNode.style.zIndex = 5; // make sure GUI is on top of map
        window.gui = gui;

        gui.keyinput = keytext;
        var keyinput = gui.add(gui, 'keyinput').name("key").listen();

        gui.valueinput = valuetext;
        var valueinput = gui.add(gui, 'valueinput').name("value").listen();
        
        updateKey(keytext);
        updateValue(valuetext);
        keyinput.onChange(function(value) {
            updateKey(value);
        });
        valueinput.onChange(function(value) {
            updateValue(value);
        });

        //select input text when you click on it
        keyinput.domElement.id = "keyfilter";
        keyinput.domElement.onclick = function() { this.getElementsByTagName('input')[0].select(); };
        valueinput.domElement.id = "valuefilter";
        valueinput.domElement.onclick = function() { this.getElementsByTagName('input')[0].select(); };

        gui.clear = function() {
            clearValues();
        };
        var clear = gui.add(gui, 'clear')
        
        gui.ceiling = 1.0;
        var ceiling = gui.add(gui, 'ceiling', 0, 1);
        ceiling.onFinishChange(function(value) {
            scene.config.layers["mapillary-sequences"].properties.ceiling = value;
            scene.rebuildGeometry();
            // scene.requestRedraw();
        });

        gui.floor = .0;
        var floor = gui.add(gui, 'floor', 0, 1);
        floor.onFinishChange(function(value) {
            scene.config.layers["mapillary-sequences"].properties.floor = value;
            scene.rebuildGeometry();
            // scene.requestRedraw();
        });
        
    }

    // var scene.picking = false;
    // Feature selection
    function initFeatureSelection () {
        // Selection info shown on hover
        var selection_info = document.createElement('div');
        selection_info.setAttribute('class', 'label');
        selection_info.style.display = 'block';
        selection_info.style.zindex = 1000;

        // Show selected feature on hover
        scene.container.addEventListener('mousemove', function (event) {
            if (picking) return;
            var pixel = { x: event.clientX, y: event.clientY };

            scene.getFeatureAt(pixel).then(function(selection) {    
                if (!selection) {
                    return;
                }
                var feature = selection.feature;
                if (feature != null) {
                    var label = '';
                    if (feature.properties != null) {
                        // console.log(feature.properties);
                        var obj = JSON.parse(JSON.stringify(feature.properties));
                        label = "";
                        for (x in feature.properties) {
                            if (x == "keys" || x == "cas" ) continue;
                            val = feature.properties[x]
                            label += "<span class='labelLine' key="+x+" value="+val+" onclick='setValuesFromSpan(this)'>"+x+" : "+val+"</span><br>"
                        }
                    }

                    if (label != '') {
                        selection_info.style.left = (pixel.x + 5) + 'px';
                        selection_info.style.top = (pixel.y + 15) + 'px';
                        selection_info.innerHTML = '<span class="labelInner">' + label + '</span>';
                        scene.container.appendChild(selection_info);
                    }
                    else if (selection_info.parentNode != null) {
                        selection_info.parentNode.removeChild(selection_info);
                    }
                }
                else if (selection_info.parentNode != null) {
                    selection_info.parentNode.removeChild(selection_info);
                }
            });

            // Don't show labels while panning
            if (scene.panning == true) {
                if (selection_info.parentNode != null) {
                    selection_info.parentNode.removeChild(selection_info);
                }
            }
        });

        var click = false;
        var clickhash = map.getCenter();
        console.log(clickhash);
        // toggle popup picking state
        scene.container.onmousedown = function (event) {
                // console.log('down');
            click = true;
            clickhash = map.getCenter();
            console.log(clickhash);
            // picking = !picking;
        };
        // toggle popup picking state
        scene.container.onmouseup = function (event) {
            picking = false;
            console.log(clickhash);
            if ( clickhash == map.getCenter() ) {
                console.log('click');
                picking = true;
            } else {
                console.log('drag');
                picking = false;
                clickhash = map.getCenter();   
                console.log(clickhash);       }
        };
    }

    window.clearValues = function() {
        keytext = "";
        valuetext = "";
        gui.keytext= "";
        gui.keyinput= "";
        gui.valuetext= "";
        gui.valueinput= "";
        updateKey(keytext);
        updateValue(valuetext);
        updateURL();
    }
    window.setValuesFromSpan = function(span) {
        keytext = span.getAttribute("key");
        valuetext = span.getAttribute("value");
        gui.keytext=span.getAttribute("key");
        gui.keyinput=span.getAttribute("key");
        gui.valuetext=span.getAttribute("value");
        gui.valueinput=span.getAttribute("value");
        updateKey(keytext);
        updateValue(valuetext);
        updateURL();
    }

    // Add map
    window.addEventListener('load', function () {
        // Scene initialized
        layer.on('init', function() {
            addGUI();
            var keyfilter = document.getElementById('keyfilter').getElementsByTagName('input')[0];
            if (keyfilter.value.length == 0) keyfilter.focus();
            else keyfilter.select();

            initFeatureSelection();
        });
        layer.addTo(map);
    });

    return map;

}());

