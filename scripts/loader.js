const METADATA_HEADERS = ['Subject', 'Date', 'From'];
const TIMEOUT = 2.5 * 1000;

const DATA = {
    COLLEGE_DATA: [],
    MESSAGE_DATA: []
};

let pending = 0;

// Called after gapi is done initializing
function startLoad() {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.on('click', handleAuthClick);
    signoutButton.on('click', handleSignoutClick);

    loadColleges();
}

/*
Data Loading
*/

// Called when a datum is fully loaded
function emitLoaded(key) {
    DATA[key].loaded = true;
    console.log('Loaded ' + key + '!');
    if (Object.values(DATA).every(datum => datum.loaded)) {
        dataWorker.postMessage(DATA);
    }
}

// Called to unload a datum
function unload(key) {
    DATA[key].loaded = false;
    console.log('Unloaded ' + key + '!');
    DATA[key].length = 0;
}

// loads College data
function loadColleges() {
    return fetch('https://raw.githubusercontent.com/kajchang/USNews-College-Scraper/master/data-detailed.csv')
        .then(response => response.text())
        .then(text => {
            DATA.COLLEGE_DATA.push(...d3.csvParse(text));
            updateCountUps();
            emitLoaded('COLLEGE_DATA');
        })
        .catch(error => {
            handleError(error);
            setTimeout(loadColleges, TIMEOUT);
        });
}

/// called when auth2 status changes
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.style('display', 'none');
        signoutButton.style('display', 'block');
        loadMessages();
        updateCountUps();
        loader.style('display', 'flex');
    } else {
        authorizeButton.style('display', 'block');
        signoutButton.style('display', 'none');
        unload('MESSAGE_DATA');
        pending = 0;
        loadingCountUps.text(0);
        totalEmails.text(0);
        loader.style('display', 'none');
        analysisTabs.style('display', 'none');
    }
}

function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick() {
    gapi.auth2.getAuthInstance().signOut();
}

function batchGetMessageInfo(messages) {
    const batch = gapi.client.newBatch();
    for (let message of messages) {
        batch.add(gapi.client.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: METADATA_HEADERS
        }));
    }
    return batch;
}

// Loads messages from a user's gmail account
function loadMessages(pageToken, root=true) {
    if (!pageToken && root) {
        pending++;
    }
    console.log('Fetching ' + pageToken);
    gapi.client.gmail.users.messages.list({
        userId: 'me',
        q: '{from: college from: university from: admissions} AND {from:.org from:.edu} -from:collegeboard.org -from:summer -from:precollege after:12/30/18',
        maxResults: 200,
        pageToken
    })
        .then(response => {
            const messages = response.result.messages;
            if (response.result.nextPageToken && root) {
                pending++;
                setTimeout(() => loadMessages(response.result.nextPageToken), TIMEOUT);
            }
            return batchGetMessageInfo(messages);
        })
        .then(response => {
            const messages = Object.values(response.result);
            if (!messages.every(message => message.status === 200)) {
                return setTimeout(() => loadMessages(pageToken, false), TIMEOUT * 2);
            }
            console.log('Received ' + messages.length + ' Messages');
            DATA.MESSAGE_DATA.push(...messages);
            updateCountUps();
            pending--;
            if (pending === 0) {
                emitLoaded('MESSAGE_DATA');
            }
        })
        .catch(error => {
            if (gapi.auth2.getAuthInstance().isSignedIn.get()) {
                handleError(error);
                setTimeout(() => loadMessages(pageToken, false), TIMEOUT * 2);
            }
        });
}
