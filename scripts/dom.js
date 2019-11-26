const authorizeButton = $('#authorizeButton');
const signoutButton = $('#signoutButton');

const errorPre = $('#errorPre');
const analysisDiv = $('#analysisDiv');

const loader = $('#loader');
const messagesCountUp = new CountUp('messagesCountUp', 0);
const collegesCountUp = new CountUp('collegesCountUp', 0);
messagesCountUp.start();
collegesCountUp.start();

const dataWorker = new Worker('scripts/analysis.js');
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

function updateCountUps() {
    messagesCountUp.update(MESSAGE_DATA.length);
    collegesCountUp.update(COLLEGE_DATA.length);
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
