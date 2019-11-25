const METADATA_HEADERS = ['Subject', 'Date', 'From'];

const authorizeButton = $('#authorizeButton');
const signoutButton = $('#signoutButton');

const errorPre = $('#errorPre');
const resultsTable = $('#resultsTable');

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
        insertResultRow(METADATA_HEADERS, true);
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

function listMessages(pageToken) {
    if (!this.fetched) {
        this.fetched = [];
    }
    if (this.fetched.includes(pageToken)) {
        return;
    }
    this.fetched.push(pageToken);
    console.log('Fetching ' + pageToken);
    gapi.client.gmail.users.messages.list({
        userId: 'me',
        q: '{from: college from: university from: admissions} AND {from:.org from:.edu} -from:collegeboard.org -from:summer',
        maxResults: 200,
        pageToken
    })
        .then(response => {
            const messages = response.result.messages;
            console.log('Received ' + messages.length + ' Messages');
            if (response.result.nextPageToken) {
                setTimeout(() => listMessages(response.result.nextPageToken), 2500);
            }
            return batchGetMessageInfo(messages);
        })
        .then(response => {
            const messages = Object.values(response.result);
            if (!messages.every(message => message.status === 200)) {
                return setTimeout(() => listMessages(pageToken), 5000);
            }
            for (let message of messages) {
                insertResultRow(message.result.payload.headers
                    .sort((a, b) => METADATA_HEADERS.indexOf(a.name) - METADATA_HEADERS.indexOf(b.name))
                    .map(header => header.value));
            }
        })
        .catch(error => {
            handleError(error);
            setTimeout(() => listMessages(pageToken), 5000);
        });
}
