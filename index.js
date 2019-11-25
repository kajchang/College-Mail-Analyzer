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
        listLabels();
    } else {
        authorizeButton.show();
        signoutButton.hide();
    }
}

function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick() {
    gapi.auth2.getAuthInstance().signOut();
}

function handleError(error) {
    errorPre.text(JSON.stringify(error, null, 2));
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

function listLabels() {
    gapi.client.gmail.users.messages.list({
        userId: 'me',
        q: 'from: college OR from: university OR from: admissions'
    })
        .then(response => {
            const messages = response.result.messages;
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
        })
        .then(response => {
            clearResultsTable();
            insertResultRow(METADATA_HEADERS, true);
            const messages = Object.values(response.result);
            for (let message of messages) {
                insertResultRow(message.result.payload.headers
                    .sort((a, b) => METADATA_HEADERS.indexOf(a.name) - METADATA_HEADERS.indexOf(b.name))
                    .map(header => header.value));
            }
        })
        .catch(handleError);
}
