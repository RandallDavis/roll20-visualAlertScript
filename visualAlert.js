// Github:    https://github.com/RandallDavis/roll20-visualAlertScript
// By:        Rand Davis
// Contact:   https://app.roll20.net/users/163846/rand

var APIVisualAlert = APIVisualAlert || (function() {
    
    var version = 0.1,
        schemaVersion = 0.1;
    
    //settings:
    var defaultBlinks = 2,
        blinkWidth = 55,
        animationDelay = 50,
        defaultExlodeWidth = 1000;
        
        
    checkInstall = function() {
        if(!_.has(state,'APIVisualAlert') || state.APIVisualAlert.version !== schemaVersion) {
            log('APIVisualAlert: Resetting state.');
            
            //clear cache entirely:
            cleanCache(0);
            
            state.APIVisualAlert = {
                version: schemaVersion,
                cacheLifetimeDays: 30,
                images: {},
            };
        }
    },
    
    positionImage = function(pic, positionX, positionY, dimensionScale, width) {
        pic.set('left', positionX);
        pic.set('top', positionY);
        pic.set('width', width);
        pic.set('height', width / dimensionScale);
    },
    
    animate = function(animationState) {
        
        var delay = animationDelay;
        
        //if not in the middle of a step, handle the next step in the sequence:
        if(!animationState.step) {
            
            //there is nothing more to do with the animation:
            if(animationState.sequence.length == 0) {
                return;
            }
            
            //set up the next step in the sequence:
            var nextStep = animationState.sequence.shift();
            
            switch(nextStep.step) {
                case 'positionStart':
                        animationState.pic.set('layer', 'objects');
                        animationState.pic.set('tint_color','000000');
                        toFront(animationState.pic);
                        positionImage(animationState.pic, animationState.positionX, animationState.positionY, animationState.dimensionScale, 0);
                        
                        //use a long delay to wait for Roll20's move animation to finish:
                        delay = 500;
                    break;
                case 'blink':
                        animationState.sequence.unshift({
                            'step': 'blinkContract',
                            'expansionWidth': nextStep.expansionWidth,
                        });
                        animationState.sequence.unshift({
                            'step': 'blinkExpand',
                            'expansionWidth': nextStep.expansionWidth,
                        });
                    break;
                case 'positionEnd':
                        animationState.pic.set('layer', 'gmlayer');
                        positionImage(animationState.pic, 10, 10, animationState.dimensionScale, 0);
                    break;
                case 'explode':
                        animationState.stepExplodeExpansionWidth = nextStep.expansionWidth;
                        animationState.step = nextStep.step;
                case 'blinkExpand':
                        animationState.stepBlinkExpandExpansionWidth = nextStep.expansionWidth;
                        animationState.step = nextStep.step;
                    break;
                case 'blinkContract':
                        animationState.stepBlinkContractExpansionWidth = nextStep.expansionWidth;
                        animationState.step = nextStep.step;
                    break;
            }
        } else {
            switch(animationState.step) {
                case 'blinkExpand':
                        if(!blinkExpand(
                                animationState.pic,
                                animationState.positionX,
                                animationState.positionY,
                                animationState.dimensionScale,
                                animationState.stepBlinkExpandExpansionWidth)) {
                            animationState.step = null;
                            delete(animationState.stepBlinkExpandExpansionWidth);
                        }
                    break;
                case 'blinkContract':
                        if(!blinkContract(
                                animationState.pic,
                                animationState.positionX,
                                animationState.positionY,
                                animationState.dimensionScale,
                                animationState.stepBlinkContractExpansionWidth)) {
                            animationState.step = null;
                            delete(animationState.stepBlinkContractExpansionWidth);
                        }
                    break;
                case 'explode':
                        if(!explode(
                                animationState.pic,
                                animationState.positionX,
                                animationState.positionY,
                                animationState.dimensionScale,
                                animationState.stepExplodeExpansionWidth)) {
                            animationState.step = null;
                            delete(animationState.stepExplodeExpansionWidth);
                            
                            //set short delay to make the image disappear quickly:
                            delay = 1;
                        }
                    break;
            }
        }
 
        //loop animations:
        setTimeout(_.bind(
                animate, this, animationState
            ), delay);
    },
    
    blinkExpand = function(pic, positionX, positionY, dimensionScale, expansionWidth) {
        if(pic.get('width') >= expansionWidth - 1) {
            return false;
        }
         
        var expansion = Math.max(1, expansionWidth * Math.pow(Math.max(pic.get('width'), 0.01) / expansionWidth, 0.7));
        positionImage(pic, positionX, positionY, dimensionScale, expansion);
        
        return true;
    },
    
    blinkContract = function(pic, positionX, positionY, dimensionScale, beginningWidth) {
        if(pic.get('width') <= 1) {
            positionImage(pic, positionX, positionY, dimensionScale, 0);
            return false;
        }
         
        var contraction = Math.max(1, beginningWidth * Math.pow(Math.max(pic.get('width'), 0.01) / beginningWidth, 5));
        positionImage(pic, positionX, positionY, dimensionScale, contraction);
        
        return true;
    },
    
    explode = function(pic, positionX, positionY, dimensionScale, expansionWidth) {
        if(pic.get('width') >= expansionWidth - 1) {
            return false;
        }
        
        var expandPercent = Math.pow(Math.max(pic.get('width'), 0.01) / expansionWidth, 0.55);
        var width = Math.max(1, expansionWidth * expandPercent);
        
        //tint image:
        var tintHex = '00' + Math.floor(Math.sin(expandPercent * Math.PI / 2) * 255).toString(16);
        tintHex = tintHex.substring(tintHex.length - 2);
        pic.set('tint_color', (tintHex + tintHex + tintHex));
        
        //resize image:
        positionImage(pic, positionX, positionY, dimensionScale, width);
        
        return true;
    },
    
    alert = function(sourceUrl, positionX, positionY, dimensionScale, blinks, explodeWidth) {
        
        //set parameter defaults:
        dimensionScale = typeof(dimensionScale) !== 'undefined' ? dimensionScale : 1.0;
        blinks = typeof(blinks) !== 'undefined' ? blinks : defaultBlinks;
        explodeWidth = typeof(explodeWidth) !== 'undefined' ? explodeWidth : defaultExlodeWidth;
        
        //get the image:
        var pic = getImage(sourceUrl);
        
        //build animation instructions:
        var animationSequence = new Array();
        
        //setup initial positioning:
        animationSequence.push({
            'step': 'positionStart',
        });
        
        //setup blinks:
        for(var i = 0;i<blinks;i++) {
            animationSequence.push({
                'step': 'blink',
                'expansionWidth': blinkWidth,
            });
        }
        
        //setup explosion:
        animationSequence.push({
            'step': 'explode',
            'expansionWidth': explodeWidth,
        });
        
        //setup final positioning of dormant image:
        animationSequence.push({
            'step': 'positionEnd',
        });
        
        //set up an object that is used to keep state in the animation routine:
        var animationState = {
            'pic': pic,
            'positionX': positionX,
            'positionY': positionY,
            'dimensionScale': dimensionScale,
            'sequence': animationSequence,
        };
        
        //begin animation:
        animate(animationState);
    },
    
    getImage = function(sourceUrl) {
        var pageId = Campaign().get("playerpageid");
        var images = state.APIVisualAlert.images;
        var key = pageId + '*' + sourceUrl;
        var imageStorage = images['key'];
        var image;
        
        //find a previously created image:
        if(typeof(imageStorage) !== 'undefined' && imageStorage !== null) {
            image = getObj('graphic', imageStorage.objId);
        }
        
        //create the image if it can't be found:
        if(image == null) {
            image = createObj('graphic', {
                imgsrc: sourceUrl,
                layer: "gmlayer",
                pageid: pageId,
                top: 10,
                left: 10,
                width: 0,
                height: 0,
                scale: 0.0000001,
            });
        }
        
        //store the image info:
        images[key] = {
            objId: image.id,
            lastTouched: new Date().getTime(),
        };
        
        return image;
    },
    
    cleanCache = function(cacheLifetimeDays) {
        
        cacheLifetimeDays = typeof(cacheLifetimeDays) !== 'undefined' ? cacheLifetimeDays : state.APIVisualAlert.cacheLifetimeDays;
        
        var images = state.APIVisualAlert.images;
        
        for(var imageKey in images) {
            var image = images[imageKey];
            
            if(Math.floor((new Date().getTime() - image['lastTouched']) / 86400000) >= cacheLifetimeDays) {
                getObj('graphic', image.objId).remove();
                delete(images[imageKey]);
            }
        }
    };
    
    //expose public functions:
    return {
        checkInstall: checkInstall,
        cleanCache: cleanCache,
    };
    
}());


//run the script:
on('ready', function() {
    APIVisualAlert.checkInstall();
    APIVisualAlert.cleanCache();
});