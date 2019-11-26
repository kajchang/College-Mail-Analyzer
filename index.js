const METADATA_HEADERS = ['Subject', 'Date', 'From'];
const TIMEOUT = 2.5 * 1000;

const authorizeButton = $('#authorizeButton');
const signoutButton = $('#signoutButton');

const errorPre = $('#errorPre');
const resultsTable = $('#resultsTable');

let COLLEGE_DATA = [];
let MESSAGE_DATA = [];

let pending = 0;

function loadCollegeData() {
    return fetch('https://raw.githubusercontent.com/kajchang/USNews-College-Scraper/master/data-detailed.csv')
        .then(response => response.text())
        .then(text => {
            const lines = text.split('\n');
            const headers = lines[0].split(',');
            for (let line of lines.slice(1)) {
                const cells = line.split(',');
                COLLEGE_DATA.push(headers.reduce((acc, cur, i) => ({
                    ...acc,
                    [cur]: cells[i]
                }), {}));
            }
            console.log('Loaded College Data!');
        })
        .catch(error => {
            handleError(error);
            setTimeout(loadCollegeData, TIMEOUT);
        });
}

function initUI() {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.click(handleAuthClick);
    signoutButton.click(handleSignoutClick);

    loadCollegeData();
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.hide();
        signoutButton.show();
        allMessages = [];
        listMessages();
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
    const row = $('<tr/>');
    for (let datum of data) {
        const cell = $(header ? '<th/>' : '<td/>');
        cell.addClass('mdl-data-table__cell--non-numeric');
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

function listMessages(pageToken, root=true) {
    console.log('Fetching ' + pageToken);
    if (root) {
        pending++;
    }
    gapi.client.gmail.users.messages.list({
        userId: 'me',
        q: '{from: college from: university from: admissions} AND {from:.org from:.edu} -from:collegeboard.org -from:summer after:12/30/18',
        maxResults: 200,
        pageToken
    })
        .then(response => {
            const messages = response.result.messages;
            if (response.result.nextPageToken && root) {
                listMessages(response.result.nextPageToken);
            }
            return batchGetMessageInfo(messages);
        })
        .then(response => {
            pending--;
            const messages = Object.values(response.result);
            if (!messages.every(message => message.status === 200)) {
                pending++;
                return setTimeout(() => listMessages(pageToken, false), TIMEOUT * 2);
            }
            console.log('Received ' + messages.length + ' Messages');
            if (pending === 0) {
                console.log('Loaded Message Data!');
            }
            MESSAGE_DATA.push(...messages);
            MESSAGE_DATA = MESSAGE_DATA.sort((a, b) => +new Date(b.result.payload.headers.find(header => header.name === 'Date').value) - +new Date(a.result.payload.headers.find(header => header.name === 'Date').value));
            if (gapi.auth2.getAuthInstance().isSignedIn.get()) {
                clearResultsTable();
                insertResultRow(METADATA_HEADERS, true);
                for (let message of MESSAGE_DATA) {
                    insertResultRow(message.result.payload.headers
                        .sort((a, b) => METADATA_HEADERS.indexOf(a.name) - METADATA_HEADERS.indexOf(b.name))
                        .map(header => header.value));
                }
            }
        })
        .catch(error => {
            if (gapi.auth2.getAuthInstance().isSignedIn.get()) {
                handleError(error);
                pending++;
                setTimeout(() => listMessages(pageToken, false), TIMEOUT * 2);
            }
        });
}
