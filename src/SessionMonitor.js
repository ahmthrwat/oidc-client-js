// Copyright (c) Brock Allen & Dominick Baier. All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

import Log from './Log';
import CheckSessionIFrame from './CheckSessionIFrame';

export default class SessionMonitor {

    constructor(userManager, CheckSessionIFrameCtor = CheckSessionIFrame) {
        if (!userManager) {
            Log.error("No user manager passed to SessionMonitor");
            throw new Error("userManager");
        }

        this._userManager = userManager;
        this._CheckSessionIFrameCtor = CheckSessionIFrameCtor;

        this._userManager.events.addUserLoaded(this._start.bind(this));
        this._userManager.events.addUserUnloaded(this._stop.bind(this));

        this._userManager.getUser().then(user => {
            if (user) {
                this._start(user);
            }
        }).catch(err => {
            // catch to suppress errors since we're in a ctor
            Log.error("SessionMonitor ctor; error from getUser:", err.message);
        });
    }

    get _settings() {
        return this._userManager.settings;
    }
    get _metadataService() {
        return this._userManager.metadataService;
    }
    get _client_id() {
        return this._settings.client_id;
    }
    get _checkSessionInterval() {
        return this._settings.checkSessionInterval;
    }

    _start(user) {
        let session_state = user.session_state;

        if (session_state) {
            this._sub = user.profile.sub;
            Log.info("SessionMonitor._start; session_state:", session_state, ", sub:", this._sub);

            if (!this._checkSessionIFrame) {
                this._metadataService.getCheckSessionIframe().then(url => {
                    if (url) {
                        Log.info("Initializing check session iframe")

                        let client_id = this._client_id;
                        let interval = this._checkSessionInterval;

                        this._checkSessionIFrame = new this._CheckSessionIFrameCtor(this._callback.bind(this), client_id, url, interval);
                        this._checkSessionIFrame.start(session_state);
                    }
                    else {
                        Log.warn("No check session iframe found in the metadata");
                    }
                }).catch(err => {
                    // catch to suppress errors since we're in non-promise callback
                    Log.error("Error from getCheckSessionIframe:", err.message);
                });
            }
            else {
                this._checkSessionIFrame.start(session_state);
            }
        }
    }

    _stop() {
        Log.info("SessionMonitor._stop");

        this._sub = null;

        if (this._checkSessionIFrame) {
            this._checkSessionIFrame.stop();
        }
    }

    _callback() {
        Log.info("SessionMonitor._callback; user has changed login status");
        this._userManager.events._raiseUserSignedOut();
    }
}
