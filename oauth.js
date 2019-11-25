const CLIENT_ID = '765900154861-j0tsv5fgp9bkk7me1hmaf0tqvgii2n53.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDAqaEBNkJsbh6GgU0SYqlAbG10QHRnlF4';

const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'];

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';


function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    })
        .then(initUI)
        .catch(handleError);
}
