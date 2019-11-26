const METADATA_HEADERS = ['Subject', 'Date', 'From'];
const TIMEOUT = 2.5 * 1000;

const authorizeButton = $('#authorizeButton');
const signoutButton = $('#signoutButton');

const errorPre = $('#errorPre');
const analysisDiv = $('#analysisDiv');

const loader = $('#loader');
const messagesCountUp = new CountUp('messagesCountUp', 0);
const collegesCountUp = new CountUp('collegesCountUp', 0);
messagesCountUp.start();
collegesCountUp.start();

let COLLEGE_DATA = [];
let MESSAGE_DATA = [];

let dataLoaded = {
    COLLEGE_DATA: false,
    MESSAGE_DATA: false
};

const dataWorker = new Worker('analysis.js');
dataWorker.onmessage = function (e) {
    const AGGREGATE_DATA = e.data;
    console.log('Aggregate Data: ', AGGREGATE_DATA);
    loader.hide();
    analysisDiv.empty();
    for (let { college, messages } of AGGREGATE_DATA) {
        createCard(
            `${ college['institution.displayName'] }`,
            college['institution.primaryPhotoCard'],
            `${
                college['institution.displayName'] }, located in ${
                college['institution.city'] }, ${
                college['institution.state'] }, is ranked ${
                college['ranking.displayRank'] } in ${
                college['institution.schoolType'].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') } and sent you ${
                messages.length } message${ messages.length > 1 ? 's' : '' }.`
        ).appendTo(analysisDiv);
    }
};
dataWorker.onerror = dataWorker.onmessageerror = console.error;

let pending = 0;

// Called when a resource is fully loaded
function emitLoaded(key) {
    dataLoaded[key] = true;
    console.log('Loaded ' + key + '!');
    if (Object.values(dataLoaded).every(_ => _)) {
        dataWorker.postMessage({ COLLEGE_DATA, MESSAGE_DATA });
    }
}

function updateCountUps() {
    messagesCountUp.update(MESSAGE_DATA.length);
    collegesCountUp.update(COLLEGE_DATA.length);
}

// Loads College data
function loadColleges() {
    return fetch('https://raw.githubusercontent.com/kajchang/USNews-College-Scraper/master/data-detailed.csv')
        .then(response => response.text())
        .then(text => {
            COLLEGE_DATA = $.csv.toObjects(text);
            updateCountUps();
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
        loadMessages();
        updateCountUps();
        loader.show();
    } else {
        authorizeButton.show();
        signoutButton.hide();
        dataLoaded.MESSAGE_DATA = false;
        MESSAGE_DATA = [];
        pending = 0;
        updateCountUps();
        loader.hide();
        analysisDiv.empty();
    }
}

function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick() {
    gapi.auth2.getAuthInstance().signOut();
}

function handleError(error) {
    console.error(error);
    let message;
    if (error instanceof Error) {
        message = error.toString();
    } else {
        message = JSON.stringify(error, null, 2);
    }
    errorPre.text(message);
}

function createCard(title, image, description) {
    return $(`
        <div class="mdl-card mdl-shadow--2dp card">
            <div class="mdl-card__title" style="
                background: url('${ image }');
                background-size: cover; height: 150px; color: ${ image ? 'white' : 'inherit' };"
            >
                <h2 class="mdl-card__title-text">${ title }</h2>
            </div>
            <div class="mdl-card__supporting-text">${ description }</div>
        </div>
    `);
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
            MESSAGE_DATA.push(...messages);
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
