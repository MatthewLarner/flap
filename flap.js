var doc = require('doc-js'),
    EventEmitter = require('events').EventEmitter,
    interact = require('interact-js'),
    crel = require('crel'),
    venfix = require('venfix');

function Flap(element){
    this.render(element);
    this.bind();
    setTimeout(this.init.bind(this),10);
}
Flap.prototype = Object.create(EventEmitter.prototype);

Flap.prototype.constructor = Flap;
Flap.prototype.distance = 0;
Flap.prototype.state = 'closed';
Flap.prototype.width = 280;
Flap.prototype.side = 'left';
Flap.prototype.gutter = 20;

Flap.prototype.render = function(element){
    this.element = element || crel('div',
        crel('div')
    );

    this.content = this.element.childNodes[0];
    this.element.flap = this;
};
Flap.prototype.bind = function(){
    var flap = this,
        delegateTarget = this.delegateTarget || document;

    // Allow starting the drag on a delegate target
    interact.on('start', delegateTarget, flap._start.bind(flap));

    // Still use document for the other events for robustness.
    interact.on('drag', document, flap._drag.bind(flap));
    interact.on('end', document, flap._end.bind(flap));

    doc(this.element).on('click', flap._activate.bind(flap));
};
Flap.prototype.init = function(){
    var flap = this;

    this.element.style.position = 'fixed';
    this.element.style.top = '0px';
    this.element.style.bottom = '0px';
    this._setClosed();

    this.content.style[venfix('boxSizing')] = 'border-box';
    this.content.style.width = this.width + 'px';
    this.content.style.position = 'absolute';
    this.content.style.top = '0px';
    this.content.style.bottom = '0px';
    this.content.style.width = this.width + 'px';
    this.content.style['overflow-x'] = 'hidden';
    this.content.style['overflow-y'] = 'auto';

    if(this.side === 'left'){
        this.element.style.left = '0px';
        this.content.style.left = '0px';
    }else if(this.side === 'right'){
        this.element.style.right = '0px';
        this.content.style.left = '100%';
    }
    this.update();
    this.emit('ready');
};
Flap.prototype._isValidInteraction = function(interaction){
    if(this.constructor.openFlap){
        return this.constructor.openFlap === this;
    }
    if(this.distance){
        return true;
    }
    if(this.side === 'left'){
        return interaction.pageX < this.distance + this.gutter;
    }else if(this.side === 'right'){
        return interaction.pageX > window.innerWidth - this.gutter;
    }
};
Flap.prototype._start = function(interaction){
    var flap = this;

    if(this._isValidInteraction(interaction)){
        this._setOpen();
    }
};
Flap.prototype._drag = function(interaction){
    var flap = this;

    if(this.constructor.openFlap === this){
        var angle = interaction.getCurrentAngle(true);
        if(angle && !this.beingTouched && ((angle > 45 && angle < 135) || (angle < -45 && angle > -135))){
            this.constructor.openFlap = null;
            return;
        }

        interaction.preventDefault();

        flap.beingTouched = true;
        flap.startDistance = flap.startDistance || flap.distance;
        if(flap.side === 'left'){
            flap.distance = flap.startDistance + interaction.pageX - interaction.lastStart.pageX;
        }else{
            flap.distance = flap.startDistance - interaction.pageX + interaction.lastStart.pageX;
        }
        flap.distance = Math.max(Math.min(flap.distance, flap.width), 0);
        flap.update();
        flap.speed = flap.distance - flap.oldDistance;
        flap.oldDistance = flap.distance;
    }
};
Flap.prototype._end = function(interaction){
    if(this.constructor.openFlap !== this){
        return;
    }

    this.startDistance = null;
    this.beingTouched = false;

    var direction = 'close';

    if(Math.abs(this.speed) >= 3){
        direction = this.speed < 0 ? 'close' : 'open';
    }else if(this.distance < this.width / 2){
        direction = 'close';
    }else{
        direction = 'open';
    }

    this.settle(direction);
};
Flap.prototype._activate = function(event){
    if(
        !doc(event.target).closest(this.content) &&
        this.constructor.openFlap === this
    ){
        event.preventDefault();
        this.beingTouched = false;
        this.settle('close');
    }
};
Flap.prototype._setOpen = function(){
    if(this.constructor.openFlap !== this){
        var flap = this;
        this.constructor.openFlap = this;
        this.element.style['width'] = '100%';
        this.state = 'open';
        this.emit('open');

        // This prevents the flap from screwing up
        // events on elements that may be under the swipe zone
        this._pointerEventTimeout = setTimeout(function(){
            flap.element.style[venfix('pointerEvents')] = 'all';
        },500);
    }
};
Flap.prototype._setClosed = function(){
    this.constructor.openFlap = null;
    clearTimeout(this._pointerEventTimeout);
    this.element.style[venfix('pointerEvents')] = 'none';
    this.element.style['width'] = this.gutter + 'px';
    this.state = 'closed';
    this.emit('close');
};
Flap.prototype.update = function(interaction){
    var flap = this;

    if(this.distance > 0){
        this._setOpen();
    }

    if(this.side === 'left'){
        this.displayPosition = flap.distance - flap.width;
    }else if(this.side === 'right'){
        this.displayPosition = -flap.distance;
    }

    if(flap.distance != flap.lastDistance){
        requestAnimationFrame(function(){
            flap.updateStyle(flap.displayPosition);
            flap.emit('move');
            flap.lastDistance = flap.distance;
        });
    }
};
Flap.prototype.updateStyle = function(displayPosition){
    this.content.style[venfix('transform')] = 'translate3d(' + (displayPosition) + 'px,0,0)';
};
Flap.prototype.settle = function(direction){
    var flap = this;

    if(this.beingTouched){
        return;
    }
    if(this.distance < 0){
        this.distance = 0;
        this._setClosed();
        this.update();
        return;
    }else if(this.distance > this.width){
        this.distance = this.width;
        this.update();
        return;
    }

    requestAnimationFrame(function(){
        var step = flap.tween(direction);
        flap.distance += direction === 'close' ? -step : step;
        flap.update();
        flap.settle(direction);
    });
};
Flap.prototype.tween = function(direction){
    return (this.width - this.distance) / 4 + 2;
};
Flap.prototype.percentOpen = function(){
    return parseInt(100 / this.width * this.distance);
};
Flap.prototype.open = function(){
    this.settle('open');
};
Flap.prototype.close = function(){
    this.settle('close');
};
module.exports = Flap;