const METADATA_HEADERS = ['Subject', 'Date', 'From'];
const TIMEOUT = 2.5 * 1000;

const authorizeButton = $('#authorizeButton');
const signoutButton = $('#signoutButton');

const errorPre = $('#errorPre');
const resultsTable = $('#resultsTable');

let COLLEGE_DATA = [];
let MESSAGE_DATA = [];

let dataLoaded = {
    COLLEGE_DATA: false,
    MESSAGE_DATA: false
};

let pending = 0;

// Called when a resource is fully loaded
function emitLoaded(key) {
    dataLoaded[key] = true;
    console.log('Loaded ' + key + '!');
    if (Object.values(dataLoaded).every(_ => _)) {
        analyzeData();
    }
}

// Loads College data
function loadColleges() {
    return fetch('https://raw.githubusercontent.com/kajchang/USNews-College-Scraper/master/data-detailed.csv')
        .then(response => response.text())
        .then(text => {
            COLLEGE_DATA = $.csv.toObjects(text);
            emitLoaded('COLLEGE_DATA');
        })
        .catch(error => {
            handleError(error);
            setTimeout(loadColleges, TIMEOUT);
        });
}

// Called after gapi is done initializing
function initUI() {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.click(handleAuthClick);
    signoutButton.click(handleSignoutClick);

    loadColleges();
}

// Called when auth2 status changes
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.hide();
        signoutButton.show();
        MESSAGE_DATA = [];
        AGGREGATE_DATA = [];
        dataLoaded.MESSAGE_DATA = false;
        loadMessages();
    } else {
        authorizeButton.show();
        signoutButton.hide();
        clearResultsTable();
    }
}

function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick() {
    gapi.auth2.getAuthInstance().signOut();
}

function handleError(error) {
    let message;
    if (error instanceof Error) {
        message = error.toString();
    } else {
        message = JSON.stringify(error, null, 2);
    }
    errorPre.text(message);
}

function clearResultsTable() {
    resultsTable.find('thead').empty();
    resultsTable.find('tbody').empty();
}

function insertResultRow(data, header=false) {
    if (header) {
        this.nonNumerical = Object.values(data);
        data = Object.keys(data);
    }
    const row = $('<tr/>');
    for (let [index, datum] of data.entries()) {
        const cell = $(header ? '<th/>' : '<td/>');
        if (this.nonNumerical[index]) {
            cell.addClass('mdl-data-table__cell--non-numeric');
        }
        cell.text(datum);
        row.append(cell);
    }
    const el = resultsTable.find(header ? 'thead' : 'tbody');
    el.append(row);
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
        q: '{from: college from: university from: admissions} AND {from:.org from:.edu} -from:collegeboard.org -from:summer after:12/30/18',
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
            MESSAGE_DATA.push(...messages);
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
