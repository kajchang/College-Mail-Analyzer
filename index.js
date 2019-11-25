const METADATA_HEADERS = ['Subject', 'Date', 'From'];

const authorizeButton = $('#authorizeButton');
const signoutButton = $('#signoutButton');

const errorPre = $('#errorPre');
const resultsTable = $('#resultsTable');

let allMessages = [];

function initUI() {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.click(handleAuthClick);
    signoutButton.click(handleSignoutClick);
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
    gapi.client.gmail.users.messages.list({
        userId: 'me',
        q: '{from: college from: university from: admissions} AND {from:.org from:.edu} -from:collegeboard.org -from:summer after:12/30/18',
        maxResults: 200,
        pageToken
    })
        .then(response => {
            const messages = response.result.messages;
            if (response.result.nextPageToken && root) {
                setTimeout(() => listMessages(response.result.nextPageToken), 2500);
            }
            return batchGetMessageInfo(messages);
        })
        .then(response => {
            const messages = Object.values(response.result);
            if (!messages.every(message => message.status === 200)) {
                return setTimeout(() => listMessages(pageToken, false), 5000);
            }
            console.log('Received ' + messages.length + ' Messages');
            allMessages.push(...messages);
            allMessages = allMessages.sort((a, b) => +new Date(b.result.payload.headers.find(header => header.name === 'Date').value) - +new Date(a.result.payload.headers.find(header => header.name === 'Date').value));
            clearResultsTable();
            insertResultRow(METADATA_HEADERS, true);
            for (let message of allMessages) {
                insertResultRow(message.result.payload.headers
                    .sort((a, b) => METADATA_HEADERS.indexOf(a.name) - METADATA_HEADERS.indexOf(b.name))
                    .map(header => header.value));
            }
        })
        .catch(error => {
            handleError(error);
            setTimeout(() => listMessages(pageToken, false), 5000);
        });
}
