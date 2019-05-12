/*!
 * smallPop 0.1.2 | https://github.com/silvio-r/spop
 * Copyright (c) 2015 Sílvio Rosa @silvior_
 * MIT license
 */

	'use strict';

	var animationTime = 390;
	var options, defaults, container, icon, layout, popStyle, positions, close;

	var SmallPop = function(template, style) {

		this.defaults = {
			template  : null,
			style     : 'info',
			autoclose : false,
			position  : 'top-right',
			icon      : true,
			group     : false,
			onOpen    : false,
			onClose   : false
		};

		defaults = extend(this.defaults, spop.defaults);

		if ( typeof template === 'string' || typeof style === 'string' ) {
			options = { template: template, style: style || defaults.style};
		}
		else if (typeof template === 'object') {
			options = template;
		}
		else {
			console.error('Invalid arguments.');
			return false;
		}

		this.opt = extend( defaults, options);

		if ($('spop--' + this.opt.group)) {

			this.remove($('spop--' + this.opt.group));
		}

		this.open();
	};

	SmallPop.prototype.create = function(template) {

		container = $(this.getPosition('spop--', this.opt.position));

		icon = (!this.opt.icon) ? '' : '<div class="spop-icon '+
		            this.getIconClass(this.opt.style) +'"></div>';

		layout =icon +
					'<div class="spop-body">' +
						template +
					'</div>' + '<div class="spop-close" data-spop="close" aria-label="Close">&times;</div>';

		if (!container) {

			this.popContainer = document.createElement('div');

			this.popContainer.setAttribute('class', 'spop-container ' +
				this.getPosition('spop--', this.opt.position));

			this.popContainer.setAttribute('id', this.getPosition('spop--', this.opt.position));

			document.body.appendChild(this.popContainer);

			container = $(this.getPosition('spop--', this.opt.position));
		}

		this.pop = document.createElement('div');

		this.pop.setAttribute('class', 'spop spop--out spop--in ' + this.getStyle('spop--', this.opt.style) );

		if (this.opt.group && typeof this.opt.group === 'string') {
			this.pop.setAttribute('id', 'spop--' + this.opt.group);
		}


		this.pop.setAttribute('role', 'alert');

		this.pop.innerHTML = layout;

		container.appendChild(this.pop);
	};

	SmallPop.prototype.getIconClass =  function( arg){
		var table = {
			'success': "fas fa-check-circle",
			'error'  : "fas fa-times",
			'warning': "fas fa-exclamation"
		}
		
		return table[arg];
	}

	SmallPop.prototype.getStyle = function(sufix, arg) {

		popStyle = {
			'success': 'success',
			'error'  : 'error',
			'warning': 'warning'
		};
		return sufix + (popStyle[arg] || 'info');
	};

	SmallPop.prototype.getPosition = function(sufix, position) {

		positions = {
			'top-left'     : 'top-left',
			'top-center'   : 'top-center',
			'top-right'    : 'top-right',
			'bottom-left'  : 'bottom-left',
			'bottom-center': 'bottom-center',
			'bottom-right' : 'bottom-right'
		};
		return sufix + (positions[position] || 'top-right');
	};

	SmallPop.prototype.open = function() {

		this.create(this.opt.template);

		if (this.opt.onOpen) { this.opt.onOpen();}

		this.close();
	};

	SmallPop.prototype.close = function () {

		if (this.opt.autoclose && typeof this.opt.autoclose === 'number') {

			this.autocloseTimer = setTimeout( this.remove.bind(this, this.pop), this.opt.autoclose);
		}

		this.pop.addEventListener('click', this.addListeners.bind(this) , false);
	};

	SmallPop.prototype.addListeners = function(event) {

		close = event.target.getAttribute('data-spop');

		if (close === 'close') {

			if (this.autocloseTimer) { clearTimeout(this.autocloseTimer);}

			this.remove(this.pop);
		}
	};

	SmallPop.prototype.remove = function(elm) {

		if (this.opt.onClose) { this.opt.onClose();}

		removeClass(elm, 'spop--in');

		setTimeout( function () {

			if(document.body.contains(elm)) {
				elm.parentNode.removeChild(elm);
			}

		}, animationTime);
	};


	// Helpers

	function $(el, con) {
		return typeof el === 'string'? (con || document).getElementById(el) : el || null;
	}

	function removeClass(el, className) {
		if (el.classList) {
			el.classList.remove(className);
		}
		else {
			el.className = el.className.replace(new RegExp('(^|\\b)' +
							className.split(' ').join('|') +
							'(\\b|$)', 'gi'), ' ');
		}
	}

	function extend(obj, src) {

		for (var key in src) {
			if (src.hasOwnProperty(key)) obj[key] = src[key];
		}

		return obj;
	}

	window.spop = function (template, style) {
		if ( !template || !window.addEventListener ) { return false;}

		return new SmallPop(template, style);
	};

	spop.defaults = {};


	module.exports = window.spop;