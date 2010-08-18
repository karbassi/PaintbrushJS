// --------------------------------------------------
//
// paintbrush.js, v0.1
// A browser-based image processing library for HTML5 canvas
// Developed by Dave Shea, http://www.mezzoblue.com/
//
// This project lives on GitHub:
//    http://github.com/mezzoblue/PaintbrushJS
//
// Except where otherwise noted, PaintbrushJS is licensed under the MIT License:
//    http://www.opensource.org/licenses/mit-license.php
//
// --------------------------------------------------




// basic loader function to attach all filters being used within the page
addLoadEvent(function() {
	// only run if this browser supports canvas, obviously
	if (supports_canvas()) {
		// you can add or remove lines here, depending on which filters you're using.
		addFilter("filter-blur");
		addFilter("filter-greyscale");
		addFilter("filter-noise");
		addFilter("filter-sepia");
		addFilter("filter-tint");
	}
});





// the main workhorse function
function addFilter(filterType) {

	
	// get every element with the specified filter class
	toFilter = getElementsByClassName(filterType);

	// now let's loop through those elements
	for(var current in toFilter) {

		// load all specified parameters for this filter
		params = getFilterParameters(toFilter[current]);

		// get the image we're going to work with
		var img = getReferenceImage(toFilter[current]);

		// make sure we've actually got something to work with
		if (img.width) {
			processFilters(filterType, img, params, current, toFilter);
		} else {
			// otherwise, wait till the img loads before processing
			// (what happens if the img never loads? jury's still out)
			img.onLoad = processFilters(filterType, img, params, current, toFilter);
		}

	}


	function processFilters(filterType, img, params, current, toFilter) {

		// create working buffer
		var buffer = document.createElement("canvas");
		// get the canvas context
		var c = buffer.getContext('2d');

		// set buffer dimensions to image dimensions
		c.width = buffer.width = img.width;
		c.height = buffer.height = img.height;

		// create the temporary pixel array we'll be manipulating
		var pixels = initializeBuffer(c, img);

		if (pixels) {
			//					
			// pre-processing for various filters
			//
			// blur has to exist outside the main loop
			if (filterType == "filter-blur") {
				pixels = gaussianBlur(img, pixels, params.blurAmount);
			}
			// we need to figure out RGB values for tint, let's do that ahead and not waste time in the loop
			if (filterType == "filter-tint") {
				var src  = parseInt(createColor(params.tintColor), 16),
				    dest = {r: ((src & 0xFF0000) >> 16), g: ((src & 0x00FF00) >> 8), b: (src & 0x0000FF)};
			}
			
			
	
			// the main loop through every pixel to apply effects
			// (data is per-byte, and there are 4 bytes per pixel, so lets only loop through each pixel and save a few cycles)
			for (var i = 0, data = pixels.data, length = data.length; i < length / 4; i++) {
				var index = i * 4;
	
				// get each colour value of current pixel
				var thisPixel = {r: data[index], g: data[index + 1], b: data[index + 2]};
	
				// the biggie: if we're here, let's get some filter action happening
				pixels = applyFilters(filterType, params, pixels, index, thisPixel, dest);
			}
	
			// redraw the pixel data back to the working buffer
			c.putImageData(pixels, 0, 0);
			
			// finally, replace the original image data with the buffer
			placeReferenceImage(toFilter[current], buffer);
		}
	}





	// sniff whether this is an actual img element, or some other element with a background image
	function getReferenceImage(ref) {
		if (ref.nodeName == "IMG") {
			// create a reference to the image
			return ref;
		} 
		
		// otherwise check if a background image exists
		var bg = window.getComputedStyle(ref, null).backgroundImage;
		
		// if so, we're going to pull it out and create a new img element in the DOM
		if (bg) {
			var img = new Image();
			// kill quotes in background image declaration, if they exist
			// and return just the URL itself
			img.src = bg.replace(/['"]/g,'').slice(4, -1);
		}
		
		return img;
	}

	// re-draw manipulated pixels to the reference image, regardless whether it was an img element or some other element with a background image
	function placeReferenceImage(ref, buffer) {
		// dump the buffer as a DataURL
		result = buffer.toDataURL("image/png");
		if (ref.nodeName == "IMG") {
			img.src = result;
		} else {
			ref.style.backgroundImage = "url(" + result + ")";
		}
	}


	// throw the data-* attributes into a JSON object
	function getFilterParameters(ref) {

		// check if an attribute is set, and add its value onto the filter parameters object
		function createParameter(data, filterName, params) {
			if (data) {
				params[filterName] = data;
			}
			return params;
		}

		// create the params object and set some default parameters up front
		var params = {
			"blurAmount"		:	1,		// 0 and higher
			"greyscaleAmount"	:	1,		// between 0 and 1
			"noiseAmount"		:	30,		// 0 and higher
			"noiseType"			:	"mono",	// mono or color
			"sepiaAmount"		:	1,		// between 0 and 1
			"tintAmount"		:	0.3,	// between 0 and 1
			"tintColor"			:	"#FFF"	// any hex color
		};
		
		// check for every attribute, throw it into the params object if it exists.
		params = createParameter(ref.getAttribute("data-pb-blur-amount"), "blurAmount", params);
		params = createParameter(ref.getAttribute("data-pb-greyscale-amount"), "greyscaleAmount", params);
		params = createParameter(ref.getAttribute("data-pb-noise-amount"), "noiseAmount", params);
		params = createParameter(ref.getAttribute("data-pb-noise-type"), "noiseType", params);
		params = createParameter(ref.getAttribute("data-pb-sepia-amount"), "sepiaAmount", params);
		params = createParameter(ref.getAttribute("data-pb-tint-amount"), "tintAmount", params);
		params = createParameter(ref.getAttribute("data-pb-tint-color"), "tintColor", params);
			// O Canada, I got your back. (And UK, AU, NZ, IE, etc.)
			params = createParameter(ref.getAttribute("data-pb-tint-colour"), "tintColor", params);

		return(params);
	}


	
	function initializeBuffer(c, img) {
		// clean up the buffer between iterations
		c.clearRect(0, 0, c.width, c.height);
		// needed to prevent firefox from puking
		if (img.width > 0 && img.height > 0) {
			// draw the image to buffer and load its pixels into an array
			c.drawImage(img, 0, 0);
			return(c.getImageData(0, 0, c.width, c.height));
		}
	}




	// parse a shorthand or longhand hex string, with or without the leading '#', into something usable
	function createColor(src) {
		// strip the leading #, if it exists
		src = src.replace(/^#/, '');
		// if it's shorthand, expand the values
		if (src.length == 3) {
			src = src.replace(/(.)/g, '$1$1');
		}
		return(src);
	}

	// find a specified distance between two colours
	function findColorDifference(dif, dest, src) {
		return(dif * dest + (1 - dif) * src);
	}

	// throw three new RGB values into the pixels object at a specific spot
	function setRGB(data, index, r, g, b) {
		data[index] = r;
		data[index + 1] = g;
		data[index + 2] = b;
		return data;
	}
	

	// the function that actually manipulates the pixels
	function applyFilters(filterType, params, pixels, index, thisPixel, dest) {

		// speed up access
		var data = pixels.data,
		    val;

		// figure out which filter to apply, and do it	
		switch(filterType) {

			case "filter-greyscale":
				val = (thisPixel.r * 0.21) + (thisPixel.g * 0.71) + (thisPixel.b * 0.07);
				data = setRGB(data, index, 
					findColorDifference(params.greyscaleAmount, val, thisPixel.r),
					findColorDifference(params.greyscaleAmount, val, thisPixel.g),
					findColorDifference(params.greyscaleAmount, val, thisPixel.b));
				break;

			case "filter-noise":
				val = noise(params.noiseAmount);
				if ((params.noiseType == "mono") || (params.noiseType == "monochrome")) {
					data = setRGB(data, index, 
						thisPixel.r + val,
						thisPixel.g + val,
						thisPixel.b + val);
				} else {
					data = setRGB(data, index, 
						thisPixel.r + noise(params.noiseAmount),
						thisPixel.g + noise(params.noiseAmount),
						thisPixel.b + noise(params.noiseAmount));
				}
				break;
				
			case "filter-tint":
				data = setRGB(data, index, 
					findColorDifference(params.tintAmount, dest.r, thisPixel.r),
					findColorDifference(params.tintAmount, dest.g, thisPixel.g),
					findColorDifference(params.tintAmount, dest.b, thisPixel.b));
				break;
				
			case "filter-sepia":
				data = setRGB(data, index, 
					findColorDifference(params.sepiaAmount, (thisPixel.r * 0.393) + (thisPixel.g * 0.769) + (thisPixel.b * 0.189), thisPixel.r),
					findColorDifference(params.sepiaAmount, (thisPixel.r * 0.349) + (thisPixel.g * 0.686) + (thisPixel.b * 0.168), thisPixel.g),
					findColorDifference(params.sepiaAmount, (thisPixel.r * 0.272) + (thisPixel.g * 0.534) + (thisPixel.b * 0.131), thisPixel.b));
				break;
		}
		return(pixels);
	}


	// calculate random noise. different every time!
	function noise(noiseValue) {
		return Math.floor((Math.random() * noiseValue / 2) - noiseValue / 2);
	}

}
