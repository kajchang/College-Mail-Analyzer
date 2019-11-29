const authorizeButton = d3.select('#authorize-button');
const signoutButton = d3.select('#signout-button');

const errorPre = d3.select('#error-pre');
const analysisTabs = d3.select('#analysis-tabs');

// const summaryDiv = d3.select('#summary-div');
const schoolsDiv = d3.select('#schools-div');

const loader = d3.select('#loader');
const loadingCountUps = d3.selectAll('.loading-count-up')
    .data([MESSAGE_DATA, COLLEGE_DATA]);

const dataWorker = new Worker('scripts/analysis.js');
dataWorker.onmessage = function (e) {
    const AGGREGATE_DATA = e.data;
    console.log('Aggregate Data: ', AGGREGATE_DATA);
    loader.style('display', 'none');

    const schoolCards = schoolsDiv
        .selectAll('div')
        .data(AGGREGATE_DATA)
        .enter()
        .append('div')
        .attr('class', 'mdl-card mdl-shadow--2dp school-card');

    schoolCards
        .append('div')
        .attr('class', 'mdl-card__title')
        .style('background', d => `url('${ d.college['institution.primaryPhotoCard'] }')`)
        .style('color', d => d.college['institution.primaryPhotoCard'] ? 'white' : 'inherit')
        .append('h2')
        .attr('class', 'mdl-card__title-text')
        .text(d => d.college['institution.displayName']);

    schoolCards
        .append('div')
        .attr('class', 'mdl-card__supporting-text')
        .text(d => `${
            d.college['institution.displayName'] }, located in ${
            d.college['institution.city'] }, ${
            d.college['institution.state'] }, is ranked ${
            d.college['ranking.displayRank'] }${ d.college['ranking.isTied'] === 'True' ? ' (Tied)' : '' } in ${
            d.college['institution.schoolType'].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') } and sent you ${
            d.messages.length } message${ d.messages.length > 1 ? 's' : '' }.`);

    /*
    // Summary
    summaryDiv.empty();
    createImageCard(
        `
            <span style="margin: auto;">
                <i class="material-icons">school</i><span id="emails-count-up"></span><span style="white-space: pre;"> Emails</span>
            </span>
        `,
        '/images/gmail.png',
        ``,
        'summary-card'
    ).appendTo(summaryDiv);
    const emailsCountUp = new CountUp('emails-count-up', AGGREGATE_DATA.reduce((acc, cur) => acc + cur.messages.length, 0));
    emailsCountUp.start();
    */

    analysisTabs.style('display', 'block');
};
dataWorker.onerror = dataWorker.onmessageerror = console.error;

function updateCountUps() {
    loadingCountUps
        .transition()
        .tween('text', function (d) {
            const selection = d3.select(this);
            const start = d3.select(this).text();
            const interpolator = d3.interpolateNumber(start, d.length);

            return t => selection.text(Math.round(interpolator(t)));
        })
        .duration(1000);
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
