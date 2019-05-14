"use strict";

var keys = {
    polly:{
        accessKeyId:'AKIAIF2DRY425RPIQCJQ',
        secretAccessKey:'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'
    },
    cognitive: {
        subscriptionKey:"1bc2a0c2920f48b3bb7b92d612641e20"
    },
    luis: { // luis keys for "tokyo" app
        applicationId: "a8ba1856-8d6a-4bd0-b01a-af574ee94aab",
        subscriptionKey:"cb4788d08dd84a978c1cf41742f43794",
        authKey: "a8ba1856-8d6a-4bd0-b01a-af574ee94aab"
    }
}

var voiceconf = {
    //language: "ja-JP"
    language: "en-US"
}

// -----------------------------------------------------------------------
// Voice Kit Backend - Text to Speech
// -----------------------------------------------------------------------
function SpeechPolly(credentials) {
    this.credentials = credentials;

    try {
        if (typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined') {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.canUseWebAudio = true;
            // iOS requires a touch interaction before unlocking its web audio stack
            if (/iPad|iPhone|iPod/.test(navigator.platform)) {
                this._unlockiOSaudio();
            }
        }
    }
    catch (e) {
        console.error("Cannot initialize Web Audio Context.");
    }
}

SpeechPolly.prototype._unlockiOSaudio = function () {
    var _this = this;

    var unlockaudio = function () {
        var buffer = _this.audioContext.createBuffer(1, 1, 22050);
        var source = _this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(_this.audioContext.destination);
        source.start(0);

        setTimeout(function () {
            if (source.playbackState === source.PLAYING_STATE || source.playbackState === source.FINISHED_STATE) {
                window.removeEventListener('touchend', unlockaudio, false);
            }
        }, 0);
    };

    window.addEventListener('touchend', unlockaudio, false);
}

SpeechPolly.prototype._makeHttpReq = function (opts) {
    var xhr = new XMLHttpRequest();
    var optionalHeaders = opts.headers;
    var fn = opts.success;
    var err = opts.error;
    var dataToSend = opts.content;

    if (opts.isArrayBuffer) {
        xhr.responseType = 'arraybuffer';
    }

    xhr.onreadystatechange = function (event) {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
            if (!opts.isArrayBuffer) {
                fn(xhr.responseText);
            }
            else {
                fn(xhr.response);
            }
        } else {
            err(xhr.status);
        }
    };
    try {
        xhr.open(opts.method, opts.url, true);

        if (optionalHeaders) {
            for (var key in optionalHeaders) {
                xhr.setRequestHeader(key, optionalHeaders[key]);
            }
        }
        if (dataToSend) {
            xhr.send(dataToSend);
        }
        else {
            xhr.send();
        }
    }
    catch (ex) {
        err(ex)
    }

}

SpeechPolly.prototype.speak = function (text, fns) {
    var _this = this;

    AWS.config.region = 'us-east-1';
    AWS.config.accessKeyId = this.credentials.accessKeyId;
    AWS.config.secretAccessKey = this.credentials.secretAccessKey;

    var polly = new AWS.Polly();
    
    var voice = "Joanna";

    switch (voiceconf.language) {

        case "en-US": voice = "Joanna";
        case "ja-JP": voice = "Mizuki";

    }
   
    var params = {
        OutputFormat: "mp3",
        Text: text,
        VoiceId: "Joanna" //"Mizuki"//"Joanna"
    };

   
    // describeVoices
    let descParams = {
        LanguageCode: voiceconf.language
    };

    polly.describeVoices(descParams, (err, data)=>{
        if(err){
            console.log(err);
        } else {
            console.log(JSON.stringify(data))
        }
    });

    polly.synthesizeSpeech(params, function (err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            _this.audioContext.decodeAudioData(data.AudioStream.buffer, function (buffer) {
                var source = _this.audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(_this.audioContext.destination);

                fns && fns.onended && fns.onstarted();
                source.start(0);
                source.onended = function (evt) {
                    fns && fns.onended && fns.onended();
                };
            });
        }

        /*
        data = {
        AudioStream: <Binary String>, 
        ContentType: "audio/mpeg", 
        RequestCharacters: 37
        }
        */
    });

    // console.log(url);
}
SpeechPolly.instance = new SpeechPolly({
    accessKeyId: keys.polly.accessKeyId,
    secretAccessKey: keys.polly.secretAccessKey 
});

function TextToSpeech_Speak(text,fns) {
    SpeechPolly.instance.speak(text,fns);
}

// -----------------------------------------------------------------------
// Voice Kit Backend - Speech To Text
// -----------------------------------------------------------------------
function RecognizerSetup(subscriptionKey) {
    var recognitionMode = SpeechSDK.RecognitionMode.Interactive;
    var language = voiceconf.language; //"en-US";
    var format = SpeechSDK.SpeechResultFormat.Simple;

    var recognizerConfig = new SpeechSDK.RecognizerConfig(
        new SpeechSDK.SpeechConfig(
            new SpeechSDK.Context(
                new SpeechSDK.OS(navigator.userAgent, "Browser", null),
                new SpeechSDK.Device("SpeechSample", "SpeechSample", "1.0.00000"))),
        recognitionMode,
        language, // Supported languages are specific to each recognition mode. Refer to docs.
        format); // SDK.SpeechResultFormat.Simple (Options - Simple/Detailed)

    return SpeechSDK.CreateRecognizer(recognizerConfig, new SpeechSDK.CognitiveSubscriptionKeyAuthentication(subscriptionKey));
}
// Start the recognition
function RecognizerStart(recognizer, fns) {
    recognizer.Recognize((event) => {
        switch (event.Name) {
            case "RecognitionTriggeredEvent":
                break;
            case "ListeningStartedEvent":
                fns && fns.listening && fns.listening();
                break;
            case "RecognitionStartedEvent":
                break;
            case "SpeechStartDetectedEvent":
                fns && fns.listening && fns.speechStarted();
                //                console.log(JSON.stringify(event.Result)); // check console for other information in result
                break;
            case "SpeechHypothesisEvent":
                fns && fns.listening && fns.partial(event.Result.Text);
                // UpdateRecognizedHypothesis(event.Result.Text, false);
                // console.log(JSON.stringify(event.Result)); // check console for other information in result
                break;
            case "SpeechFragmentEvent":
                fns && fns.listening && fns.partial(event.Result.Text);
                // UpdateRecognizedHypothesis(event.Result.Text, true);
                // console.log(JSON.stringify(event.Result)); // check console for other information in result
                break;
            case "SpeechEndDetectedEvent":
                fns && fns.listening && fns.speechEnded(event.Result.Text);
                //  OnSpeechEndDetected();
                //  console.log("Processing_Adding_Final_Touches");
                //  console.log(JSON.stringify(event.Result)); // check console for other information in result
                break;
            case "SpeechSimplePhraseEvent":
                console.log(event.Result)
                fns && fns.listening && fns.final(event.Result.DisplayText);
                // console.log(JSON.stringify(event.Result)); // check console for other information in result
                // UpdateRecognizedPhrase(JSON.stringify(event.Result, null, 3));
                break;
            case "SpeechDetailedPhraseEvent":
                // console.log(JSON.stringify(event.Result)); // check console for other information in result
                // UpdateRecognizedPhrase(JSON.stringify(event.Result, null, 3));
                break;
            case "RecognitionEndedEvent":
                fns && fns.listening && fns.ended();
                //  OnComplete();
                //   console.log("Idle");
                // console.log(JSON.stringify(event)); // Debug information
                break;
            default:
                console.log(JSON.stringify(event)); // Debug information
        }
    })
        .On(() => {
            // The request succeeded. Nothing to do here.
        },
        (error) => {
            console.error(error);
        });
}

// Stop the Recognition.
function RecognizerStop(recognizer) {
    // recognizer.AudioSource.Detach(audioNodeId) can be also used here. (audioNodeId is part of ListeningStartedEvent)
    recognizer.AudioSource.TurnOff();
}

var _recognizer;
function InitSpeechToText() {
    if (!_recognizer) {
        _recognizer = RecognizerSetup(keys.cognitive.subscriptionKey);

        Noodl.eventEmitter.on('voicekit-start-listening', function () {
            RecognizerStart(_recognizer, {
                listening: function () {
                    Noodl.eventEmitter.emit('voicekit-listening-started');
                    //_this.sendSignalOnOutput('listening');
                },
                ended: function () {
                    Noodl.eventEmitter.emit('voicekit-listening-ended');
                    //_this.sendSignalOnOutput('stopped');
                },
                speechStarted: function () {
                    Noodl.eventEmitter.emit('voicekit-speech-started');
                    // _this.sendSignalOnOutput('speechStarted');
                },
                speechEnded: function () {
                    Noodl.eventEmitter.emit('voicekit-speech-ended');
                    //_this.sendSignalOnOutput('speechEnded');
                },
                partial: function (text) {
                    Noodl.eventEmitter.emit('voicekit-speech-partial', {
                        text: text
                    });
                    // internal.partial = text;
                    //  _this.flagOutputDirty("partial");
                },
                final: function (text) {
                    Noodl.eventEmitter.emit('voicekit-speech-final', {
                        text: text
                    });

                    /*internal.partial = text;
                    _this.flagOutputDirty("partial");

                    internal.final = text;
                    _this.flagOutputDirty("final");
                    (text!=="" && text !== undefined)&&_this.sendSignalOnOutput('finalReceived');*/
                }
            })
        });
    }
}

// -----------------------------------------------------------------------
// Voice Kit Backend - Intents
// -----------------------------------------------------------------------
var cachedVoiceModel;
function GetIntentModel(fn) {

    var intents = [];
    var entities = [];

    // --


    console.log("getting entities ");
    var xhr2 = new XMLHttpRequest();
    
    var body2 = keys.luis.applicationId + '/versions/0.1/entities?subscription-key=' + keys.luis.subscriptionKey;  
 
    xhr2.open('GET', 'https://westus.api.cognitive.microsoft.com/luis/api/v2.0/apps/' + body2, true);
    xhr2.setRequestHeader('content-type', 'application/json');

    xhr2.onreadystatechange = function (e) {

        if (xhr2.status == 200 && xhr2.response) {

            console.log("xhr.response:");
            console.log(xhr2.response);

            var cleanJson  = xhr2.response.replace(/(\r\n\t|\n|\r\t)/gm,""); // figure out what headers I need to not get CRLF in json
            var cleanResponse = JSON.parse(cleanJson);
            
            for (var i=0; i < cleanResponse.length; i++) {
                //console.log("hello" + cleanResponse[i].name);
                if (cleanResponse[i].readableType === "Entity Extractor") {
                    if (entities.includes(cleanResponse[i].name) ) {
                        console.log("Entity duplicate: " + cleanResponse[i].name);
                    } else {
                        entities.push(cleanResponse[i].name);
                        console.log("Added entituy: " + cleanResponse[i].name);
                    }
                }
            }
            console.log(entities);
            

        } else {
            console.log("xhr server response error:");
            console.log(e);
        }
    };
    xhr2.onerror = function (e) {
        console.log("xhr error");
        console.log(e);
    };
    
    xhr2.send();



    // --



    console.log("getting intent model");
    var xhr = new XMLHttpRequest();
    
    var body = keys.luis.applicationId + '/versions/0.1/intents?subscription-key=' + keys.luis.subscriptionKey;  
 
    xhr.open('GET', 'https://westus.api.cognitive.microsoft.com/luis/api/v2.0/apps/' + body, true);
    xhr.setRequestHeader('content-type', 'application/json');

    xhr.onreadystatechange = function (e) {

        if (xhr.status == 200 && xhr.response) {

            //console.log("xhr.response:");
            //console.log(xhr.response);

            var cleanJson  = xhr.response.replace(/(\r\n\t|\n|\r\t)/gm,""); // figure out what headers I need to not get CRLF in json

            var cleanResponse = JSON.parse(cleanJson);

            for (var i=0; i < cleanResponse.length; i++) {
                //console.log("hello" + cleanResponse[i].name);
                if (cleanResponse[i].readableType === "Intent Classifier") {
                    if (intents.includes(cleanResponse[i].name) ) {
                        console.log("Intent duplicate: " + cleanResponse[i].name);
                    } else {
                        
                        intents.push(cleanResponse[i].name);
                        console.log("Added intent: " + cleanResponse[i].name);
                    }
                }
            }
            console.log(intents);
        } else {
            console.log("xhr server response error:");
            console.log(e);
        }
    };
    xhr.onerror = function (e) {
        console.log("xhr error");
        console.log(e);
    };
    
    xhr.send();

    // -- 


    for (var i=0; i< intents.length; i++ ){
        var intentResponseItem = {
            "name" : cleanResponse[i].name,
            "slots" : entities
        }
    }
    console.log("apa");
    console.log(intentResponseItem);
    // --


    
    /* This function should return the intent model in the following format
       {
        intents:[
            {
                "name":"Name of the intent",
                "slots":[
                    {
                        "name":"name of first slot"
                    },
                    {
                        "name":"name of second slot"
                    }
                ]
            }
        ]
        }
    */

    if (cachedVoiceModel) { fn(cachedVoiceModel); return; }

  

    cachedVoiceModel = {
        intents:[
            {
                name:"weather",
                slots:[
                    {name:'city'},
                    {name:'weatherType'}
                ]
            }
        ]
    }
   /* 
    cachedVoiceModel = {
        intents:[
            {
                name:"Weather",
                slots:[
                    {name:'city'}
                ]
            }
        ]
    }
*/
    setTimeout(function() {
        console.log("in timeout");



        
        fn(cachedVoiceModel)
    },500);
}

function DiscoverIntent(text) {
    console.log('trying to discover intent');

    text = 'What is the weather in London';

    if (text) {
        console.log(text);
        var xhr = new XMLHttpRequest();
        
        var body = keys.luis.authKey + '?subscription-key='+ keys.luis.subscriptionKey +'&timezoneOffset=-360&q=';
        body += text;

        console.log('body is: ' + body);
        xhr.open('GET', 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/' + body, true);
        xhr.setRequestHeader('content-type', 'application/json');

       // https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/a8ba1856-8d6a-4bd0-b01a-af574ee94aab?subscription-key=cb4788d08dd84a978c1cf41742f43794&timezoneOffset=-360&q=
        xhr.onreadystatechange = function (e) {
    
            if (xhr.status == 200 && xhr.response) {
  
                console.log("xhr.response:");
                console.log(xhr.response);

                var cleanJson = JSON.parse(xhr.response.replace(/(\r\n\t|\n|\r\t)/gm,"")); // figure out what headers I need to not get CRLF in json

                var slotName = cleanJson.entities[0].type;
                var slotValue = cleanJson.entities[0].entity;
        
                Noodl.eventEmitter.emit('voicekit-intent-discovered',{
                    intentName: cleanJson.topScoringIntent.intent,
                    dialogState:'ReadyForFulfillment',
                    slots:{
                        slotName : slotValue
                    }
                });
            } else {
                console.log("xhr server response error:");
                console.log(e);
            }
        };
        xhr.onerror = function (e) {
            console.log("xhr error");
            console.log(e);
        };
        
        xhr.send();
    }
      

    /* This function should return the intent model in the following format
       {
        intents:[
            {
                "name":"Name of the intent",
                "slots":[
                    {
                        "name":"name of first slot"
                    },
                    {
                        "name":"name of second slot"
                    }
                ]
            }
        ]
        }
    */

    if (cachedVoiceModel) { 
        console.log("is cached"); 
        fn(cachedVoiceModel); 
        return; 
    }




    cachedVoiceModel = {
        intents:[
            {
                name:"Weather",
                slots:[
                    {name:'city'}
                ]
            }
        ]
    }

    setTimeout(function() {
        


        fn(cachedVoiceModel)
    },500);
}

function DiscoverIntent(text) {
    // This function should attempt to discover the intent of the text string in "text" and then
    // emit the voicekit-intent-discovered event with an intent in the folowing format
    
     /*   {
            intentName:'Name of intent',
            dialogState:'ReadyForFulfillment or ElicitSlot',
            slotToElicit:'The slot that is missing if dialog state is ElicitSlot',
            slots:{
                "slot name":"value of slot"
            }
        }*/

    // If no intent is discovered then voicekit-no-intent-discovered should be emitted 

    Noodl.eventEmitter.emit('voicekit-intent-discovered',{
        intentName:'Weather',
        dialogState:'ReadyForFulfillment',
        slots:{
            'city':'Chicago'
        }
    });

    // Other example, slot missing
   /* {
        intentName:'Weather',
        dialogState:'ElicitSlot',
        slotToElicit:'city'
    }*/

}

var isListeningToFinalText;
function InitIntentDiscover() {
    if(!isListeningToFinalText) {
        Noodl.eventEmitter.on('voicekit-speech-final', function (args) {
            DiscoverIntent(args.text);
        });
        isListeningToFinalText = true;
    }
}


// -----------------------------------------------------------------------
// Text To Speech
// -----------------------------------------------------------------------
var TextToSpeech = {
    name: "Voice Out",
    shortDesc: "Converts a string of text to voice audio and plays it.",
    category: "Voice",
    color: "default",
    initialize: function () {
        var internal = this._internal;

    },
    inputs: {
        start: {
            displayName: 'Speak',
            type: 'signal',
            valueChangedToTrue: function () {
                var _this = this;
                var internal = this._internal;

                // internal.tts.speak(internal.text,'enUS_Female')
                this.scheduleAfterInputsHaveUpdated(function () {
                    TextToSpeech_Speak(internal.text, {
                        onstarted: function () {
                            _this.sendSignalOnOutput('started');
                        },
                        onended: function () {
                            _this.sendSignalOnOutput('completed');
                        }
                    });
                })
            }
        },
        stop: {
            displayName: 'Stop',
            type: 'signal'
        },
        text: {
            displayName: 'Text',
            type: 'string',
            set: function (value) {
                this._internal.text = value;
            }
        },
        /* voice: {
             displayName: 'Voice',
             type: { name: 'enum', enums: [{ value: 'ken', label: 'Ken' }, { value: 'barbie', label: 'Barbie' }] }
         }*/
    },
    outputs: {
        started: {
            displayName: 'Speech started',
            type: 'signal'
        },
        completed: {
            displayName: 'Speech completed',
            type: 'signal'
        }
    },
    prototypeExtensions: {
    }
};

// -----------------------------------------------------------------------
// Match Phrase
// -----------------------------------------------------------------------
var MatchPhrase = {
    name: "Match Phrase",
    category: "Voice",
    color: "default",
    initialize: function () {
        var internal = this._internal;

        internal.enabled = true;
    },
    inputs: {
        enabled: {
            group: 'General',
            displayName: 'Enabldd',
            type: 'boolean',
            default: true,
            set: function (value) {
                this._internal.enabled = value;
            }
        },
        phrases: {
            displayName: 'Phrases',
            type: 'stringlist',
            group: 'Phrases',
            set: function (value) {
                this._internal.phrases = value;
            }
        },
        text: {
            group: 'General',
            displayName: 'Text',
            type: { name: 'string', allowConnectionsOnly: true },
            set: function (value) {
                var _this = this;

                // Check for match
                if (!this._internal.phrases) return;

                var phrases = this._internal.phrases.toLowerCase().split(',');
                var text = value.toLowerCase();
                _this._internal.textAfterPhrase = ""
                _this._internal.phrase = "";
                _this._internal.haveMatch = false;
                for (var i = 0; i < phrases.length; i++) {
                    var p = phrases[i];
                    var idx = text.indexOf(p);
                    if (idx !== -1) {
                        _this._internal.textAfterPhrase = text.substring(idx + p.length + 1);
                        _this._internal.phrase = p;
                        _this._internal.haveMatch = true;
                        _this.sendSignalOnOutput('match');
                        break;
                    }
                }

                _this.flagOutputDirty('phrase');
                _this.flagOutputDirty('afterPhrase');
                _this.flagOutputDirty('haveMatch');

            }
        }
    },
    outputs: {
        match: {
            displayName: 'Match',
            type: 'signal'
        },
        phrase: {
            displayName: 'Phrase',
            type: 'string',
            getter: function () {
                return this._internal.phrase;
            }
        },
        haveMatch: {
            displayName: 'Have Match',
            type: 'boolean',
            getter: function () {
                return this._internal.haveMatch;
            }
        },
        afterPhrase: {
            displayName: 'Text After Phrase',
            type: 'string',
            getter: function () {
                return this._internal.textAfterPhrase;
            }
        }
    },
    prototypeExtensions: {
    }
};

// -----------------------------------------------------------------------
// Intent Ready
// -----------------------------------------------------------------------
function fetchIntentsDefs(fn) {
    if (cachedVoiceModel) {
        var defs = [{ label: 'None', value: 'none' }];
        for (var i = 0; i < cachedVoiceModel.intents.length; i++) {
            var intent = cachedVoiceModel.intents[i];

            defs.push({
                label: intent.name,
                value: intent.name
            })
        }
        return defs;
    }
    else GetIntentModel(fn);
}

function fetchSlotsForIntent(intentName) {
    if (cachedVoiceModel) {
        var slots = [];
        for (var i = 0; i < cachedVoiceModel.intents.length; i++) {
            var intent = cachedVoiceModel.intents[i];

            if (intent.name === intentName && intent.slots) {
                for (var j = 0; j < intent.slots.length; j++) {
                    slots.push(intent.slots[j].name);
                }
            }
        }
        return slots;
    }
}

var IntentReadyNode = {
    name: "Intent Ready",
    category: "Voice",
    shortDesc: "This is the entry point for intents. It will send a signal when an intent is ready.",
    color: "default",
    usePortAsLabel: 'matchIntent',
    initialize: function () {
        var _this = this;
        var internal = this._internal;

        InitSpeechToText();

        InitIntentDiscover();

        Noodl.eventEmitter.on('voicekit-intent-discovered',function(intent) {
            if (intent.intentName === internal.matchIntent && intent.dialogState === 'ReadyForFulfillment') {
                internal.intent = intent;

                for (var key in intent.slots) {
                    var output = 'slot-' + key;
                    internal.slotValues[output] = intent.slots[key];
                    _this.hasOutput(output) && _this.flagOutputDirty(output);
                }
                _this.sendSignalOnOutput('matched');
            }
        })

        internal.slotValues = {};
    },
    inputs: {
        matchIntent:{
            set:function(value) {
                this._internal.matchIntent = value;
            }
        }
    },
    outputs: {
        matched: {
            displayName: 'Ready',
            type: 'signal'
        }
    },
    prototypeExtensions: {
        registerOutputIfNeeded: function (name) {
            if (this.hasOutput(name)) {
                return;
            }

            this.registerOutput(name, {
                getter: slotOutputGetter.bind(this, name)
            });
        },
    }
};

function slotOutputGetter(name) {
    /* jshint validthis:true */
    return this._internal.slotValues[name];
}

function updatePorts(id, intent, editorConnection) {
    var ports = [];

    var intentsDefs = fetchIntentsDefs(function () {
        // try again
        updatePorts(id, intent, editorConnection);
    })

    if (intentsDefs) {
        ports.push({
            name: 'matchIntent',
            group: 'General',
            plug: 'input',
            displayName: 'Match Intent',
            default: 'none',
            type: { name: 'enum', enums: intentsDefs }
        })
    }
    else {
        ports.push({
            name: 'matchIntent',
            group: 'General',
            plug: 'input',
            displayName: 'Match Intent',
            default: 'none',
            type: { name: 'enum', enums: [{ label: 'None', value: 'none' }] }
        })
    }

    var slots = fetchSlotsForIntent(intent);

    slots && slots.forEach(function (s) {
        ports.push({
            name: 'slot-' + s,
            displayName: s,
            group: 'Slots',
            plug: 'output',
            type: '*'
        })
    })

    editorConnection.sendDynamicPorts(id, ports);
}

var IntentReady = {
    node: IntentReadyNode,
    setup: function (context, graphModel) {

        if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
            return;
        }

        graphModel.on("nodeAdded.Intent Ready", function (node) {
            updatePorts(node.id, node.parameters.matchIntent, context.editorConnection);
            node.on("parameterUpdated", function (event) {
                if (event.name === "matchIntent") {
                    updatePorts(node.id, node.parameters.matchIntent, context.editorConnection);
                }
            });
        });
    }
};

// -----------------------------------------------------------------------
// Intent Slot Needed
// -----------------------------------------------------------------------
var IntentSlotNeededNode = {
    name: "Intent Slot Needed",
    category: "Voice",
    color: "default",
    usePortAsLabel: 'matchIntent',
    initialize: function () {
        var _this = this;

        var internal = this._internal;

        Noodl.eventEmitter.on('voicekit-intent-discovered',function(intent) {
            if (intent.intentName === internal.matchIntent && intent.dialogState === 'ElicitSlot' && intent.slotToElicit === internal.matchIntentSlot) {
                internal.intent = intent;

                _this.sendSignalOnOutput('matched');
            }
        })
    },
    inputs: {
        matchIntent: {
            set: function (value) {
                this._internal.matchIntent = value;
            }
        },
        matchIntentSlot: {
            set: function (value) {
                this._internal.matchIntentSlot = value;
            }
        }
    },
    outputs: {
        matched: {
            displayName: 'Matched',
            type: 'signal'
        }
    },
    prototypeExtensions: {
    }
};

function intentSlotNeededupdatePorts(id, intent, editorConnection) {
    var ports = [];

    var intentsDefs = fetchIntentsDefs(function () {
        // try again
        intentSlotNeededupdatePorts(id, intent, editorConnection);
    })

    if (intentsDefs) {
        ports.push({
            name: 'matchIntent',
            group: 'General',
            plug: 'input',
            displayName: 'Match Intent',
            default: 'none',
            type: { name: 'enum', enums: intentsDefs }
        })
    }
    else {
        ports.push({
            name: 'matchIntent',
            group: 'General',
            plug: 'input',
            displayName: 'Match Intent',
            default: 'none',
            type: { name: 'enum', enums: [{ label: 'none', value: 'None' }] }
        })
    }

    var slots = fetchSlotsForIntent(intent);

    var slotEnums = [{ label: 'Any', value: 'any' }];
    slots && slots.forEach(function (s) { slotEnums.push({ label: s, value: s }) });
    ports.push({
        name: 'matchIntentSlot',
        group: 'General',
        plug: 'input',
        displayName: 'Match Slot',
        default: 'any',
        type: { name: 'enum', enums: slotEnums }
    })

    editorConnection.sendDynamicPorts(id, ports);
}

var IntentSlotNeeded = {
    node: IntentSlotNeededNode,
    setup: function (context, graphModel) {

        if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
            return;
        }

        graphModel.on("nodeAdded.Intent Slot Needed", function (node) {
            intentSlotNeededupdatePorts(node.id, node.parameters.matchIntent, context.editorConnection);
            node.on("parameterUpdated", function (event) {
                if (event.name === "matchIntent") {
                    intentSlotNeededupdatePorts(node.id, node.parameters.matchIntent, context.editorConnection);
                }
            });
        });
    }
};

// -----------------------------------------------------------------------
// Intent Not Detected
// -----------------------------------------------------------------------
var IntentNotDiscovered = {
    name: "Intent Not Discovered",
    category: "Voice",
    color: "default",
    initialize: function () {
        var _this = this;
        
        var internal = this._internal;

        Noodl.eventEmitter.on('voicekit-no-intent-discovered',function() {
            _this.sendSignalOnOutput('matched');
        })
    },
    inputs: {
        matchIntent: {
            set: function (value) {
                this._internal.matchIntent = value;
            }
        },
        matchIntentSlot: {
            set: function (value) {
                this._internal.matchIntentSlot = value;
            }
        }
    },
    outputs: {
        matched: {
            displayName: 'Matched',
            type: 'signal'
        }
    },
    prototypeExtensions: {
    }
};

// -----------------------------------------------------------------------
// Format Response
// -----------------------------------------------------------------------
var FormatResponseNode = {
    name: "Format Response",
    category: "Voice",
    shortDesc: "Use this to format a response string with parameters.",
    color: "default",
    initialize: function () {
        var internal = this._internal;
        internal.inputValues = {};
    },
    inputs: {
        order: {
            displayName: 'Order',
            group: 'General',
            type: { name: 'enum', enums: [{ value: 'rand', label: 'Randomize' }, { value: 'inc', label: 'Incremental' }] },
            default: 'rand',
            set: function (value) {
                this._internal.order = value;
            }
        },
        responses: {
            displayName: 'Responses',
            group: 'Responses',
            type: 'stringlist',
            set: function (value) {
                this._internal.responses = value;
            }
        },
        format: {
            displayName: 'Format',
            type: 'signal',
            valueChangedToTrue: function () {
                var _this = this;
                this.scheduleAfterInputsHaveUpdated(function () {
                    _this._internal.resultDirty = true;
                    _this.flagOutputDirty('response');
                    _this.sendSignalOnOutput('responseCompleted');
                })
            }
        }
    },
    outputs: {
        responseCompleted: {
            displayName: 'Response Completed',
            type: 'signal',
        },
        response: {
            type: 'string',
            displayName: 'Response',
            getter: function () {
                var internal = this._internal;

                if (internal.resultDirty) {
                    var responses = internal.responses.split(',');
                    var response = responses[Math.floor(Math.random() * responses.length)];

                    var matches = response.match(/\{[A-Za-z0-9_]*\}/g);
                    var inputs = [];
                    if (matches) {
                        inputs = matches.map(function (name) {
                            return name.replace('{', '').replace('}', '');
                        });
                    }

                    inputs.forEach(function (name) {
                        var v = internal.inputValues[name];
                        response = response.replace('{' + name + '}', v !== undefined ? v : '');
                    });

                    internal.cachedResult = response;
                    internal.resultDirty = false;
                }
                return internal.cachedResult;
            }
        }
    },
    prototypeExtensions: {
        registerInputIfNeeded: function (name) {
            if (this.hasInput(name)) {
                return;
            }

            this.registerInput(name, {
                set: responsePortSetter.bind(this, name)
            });
        }
    }
};

function responsePortSetter(name, value) {
    /* jshint validthis:true */
    this._internal.inputValues[name] = value;
}

function formatResponseUpdatePorts(id, format, editorConnection) {
    var inputs = format.match(/\{[A-Za-z0-9_]*\}/g);
    var ports = [];
    for (var i in inputs) {
        var def = inputs[i];
        var name = def.replace('{', '').replace('}', '');
        if (!ports.find(function (p) { return p.name === name })) {
            ports.push({
                name: name,
                group: 'Slots',
                type: '*',
                plug: 'input',
            });
        }
    }
    editorConnection.sendDynamicPorts(id, ports);
}

var FormatResponse = {
    node: FormatResponseNode,
    setup: function (context, graphModel) {

        if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
            return;
        }

        graphModel.on("nodeAdded.Format Response", function (node) {
            if (node.parameters.responses) {
                formatResponseUpdatePorts(node.id, node.parameters.responses, context.editorConnection);
            }
            node.on("parameterUpdated", function (event) {
                if (event.name === "responses") {
                    formatResponseUpdatePorts(node.id, node.parameters.responses, context.editorConnection);
                }
            });
        });
    }
};

// -----------------------------------------------------------------------
// Voice In
// -----------------------------------------------------------------------
var VoiceIn = {
    name: "Voice In",
    shortDesc: "This is the entry point for all voice apps.",
    category: "Voice",
    color: "default",
    initialize: function () {
        var _this = this;
        var internal = this._internal;
        var language = this._internal;

        internal.enabled = true;

       InitSpeechToText();

        Noodl.eventEmitter.on('voicekit-speech-partial', function (args) {
            if(!_this._internal.enabled) return;

            _this._internal.text = args.text;
            _this.flagOutputDirty('text');
        });

        Noodl.eventEmitter.on('voicekit-speech-final', function (args) {
            if(!_this._internal.enabled) return;

            _this._internal.text = args.text;
            _this.flagOutputDirty('text');
            _this.sendSignalOnOutput('finalTextReceived');
        });

        Noodl.eventEmitter.on('voicekit-speech-ended', function (args) {
            if(!_this._internal.enabled) return;

            _this.sendSignalOnOutput('speechEnded');
        });

        Noodl.eventEmitter.on('voicekit-speech-started', function (args) {
            if(!_this._internal.enabled) return;

            _this.sendSignalOnOutput('speechStarted');
        });
    },
    inputs: {
        enabled: {
            group: 'General',
            displayName: 'Enabled',
            type: 'boolean',
            set: function (value) {
                return this._internal.enabled = value;
            }
        },
        startListening: {
            group: 'Actions',
            displayName: 'Start Listening',
            type: 'signal',
            valueChangedToTrue:function() {
                Noodl.eventEmitter.emit('voicekit-start-listening');
            }
        }        
    },
    outputs: {
        text: {
            group: 'General',
            displayName: 'Text',
            type: 'string',
            getter: function () {
                return this._internal.text;
            }
        },
        finalTextReceived: {
            group: 'General',
            displayName: 'Final Text Received',
            type: 'signal'
        },
        speechStarted: {
            group: 'General',
            displayName: 'Speech Started',
            type: 'signal'
        },
        speechEnded: {
            group: 'General',
            displayName: 'Speech Ended',
            type: 'signal'
        }
    },
    prototypeExtensions: {
    }
};



Noodl.defineModule({
    mqttBrokers: [
    ],
    nodes: [
        VoiceIn,
        TextToSpeech,
        MatchPhrase,
        IntentNotDiscovered,
        IntentReady,
        IntentSlotNeeded,
        FormatResponse
    ],
    settings: [
    ],
    setup: function () {
        console.log('Voice setup')
    }
});