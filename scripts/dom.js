const authorizeButton = d3.select('#authorize-button');
const signoutButton = d3.select('#signout-button');

const errorPre = d3.select('#error-pre');
const analysisTabs = d3.select('#analysis-tabs');

const schoolsDiv = d3.select('#schools-div');

const loader = d3.select('#loader');
const loadingCountUps = d3.selectAll('.loading-count-up')
    .data([DATA.MESSAGE_DATA, DATA.COLLEGE_DATA]);

const totalEmails = d3.select('#total-emails')
    .data([DATA.MESSAGE_DATA]);

const schoolTypePie = d3.select('#school-type-pie');

d3.transition.prototype.countUp = function (value) {
    if (typeof value !== 'function' && typeof value !== 'number') throw new Error;
    return this
        .tween('text', function (d) {
            const selection = d3.select(this);
            const start = parseInt(selection.text().replace(',', ''), 10);
            const end = typeof value === 'function' ? value(d) : value;
            const interpolator = d3.interpolateNumber(start, end);

            return t => selection.text(Math.round(interpolator(t)).toLocaleString());
        });
};

String.prototype.capitalize = function () {
    let str = this;
    str = str.charAt(0).toUpperCase().concat(str.slice(1));
    return str;
};

const dataWorker = new Worker('scripts/analysis.js');
dataWorker.onmessage = function (e) {
    const AGGREGATE_DATA = e.data;
    console.log('Aggregate Data: ', AGGREGATE_DATA);
    loader.style('display', 'none');

    schoolsDiv
        .selectAll('.school-card')
        .data(AGGREGATE_DATA)
        .join(
            enter => enter.append('div')
                .attr('class', 'mdl-card mdl-shadow--2dp school-card')
                .call(card => card.append('div')
                    .attr('class', 'mdl-card__title')
                    .append('h2')
                    .attr('class', 'mdl-card__title-text'))
                .call(card => card.append('div')
                    .attr('class', 'mdl-card__supporting-text'))
        )
        .call(card => card.select('.mdl-card__title')
            .style('background', d => `url('${ d.college['institution.primaryPhotoCard'] }')`)
            .style('color', d => d.college['institution.primaryPhotoCard'] ? 'white' : 'inherit'))
        .call(card => card.select('.mdl-card__title-text')
            .text(d => d.college['institution.displayName']))
        .call(card => card.select('.mdl-card__supporting-text')
            .text(d => `${
                d.college['institution.displayName'] }, located in ${
                d.college['institution.city'] }, ${
                d.college['institution.state'] }, is ranked ${
                d.college['ranking.displayRank'] }${ d.college['ranking.isTied'] === 'True' ? ' (Tied)' : '' } in ${
                d.college['institution.schoolType'].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') } and sent you ${
                d.messages.length } message${ d.messages.length > 1 ? 's' : '' }.`));

    totalEmails
        .transition()
        .countUp(d => d.length)
        .duration(1000);

    const DATA_BY_SCHOOL_TYPE = AGGREGATE_DATA
        .reduce((acc, cur) => {
            let match = acc.find(datum => datum.schoolType === cur.college['institution.schoolType']);
            if (!match) {
                match = {
                    schoolType: cur.college['institution.schoolType'],
                    messages: 0
                };
                acc.push(match);
            }
            match.messages += cur.messages.length;
            return acc;
        }, []);

    const pie = d3.pie()
        .sortValues(null)
        .value(d => d.messages);
    const width = 400,
          height = 300;
    const color = d3.scaleOrdinal()
        .domain(DATA_BY_SCHOOL_TYPE.map(d => d.schoolType))
        .range(d3.quantize(t => d3.interpolateSpectral(t * 0.8 + 0.1), DATA_BY_SCHOOL_TYPE.length).reverse());
    const arc = d3.arc()
        .innerRadius(Math.min(width, height) / 4 - 1)
        .outerRadius(Math.min(width, height) / 2 - 1);

    const arcs = pie(DATA_BY_SCHOOL_TYPE);

    schoolTypePie
        .attr('viewBox', [-width / 2, -height / 2, width, height])
        .select('g')
        .attr('stroke', 'white')
        .selectAll('path')
        .data(arcs)
        .join('path')
        .attr('id', d => d.data.schoolType.concat('-arc'))
        .attr('fill', d => color(d.data.schoolType))
        .attr('d', arc);

    d3.select(schoolTypePie.node().parentNode)
        .selectAll('span')
        .data(arcs)
        .join('span')
        .attr('class', 'mdl-tooltip mdl-tooltip--top')
        .attr('for', d => d.data.schoolType.concat('-arc'))
        .html(d => `${ d.data.schoolType.split('-').map(word => word.capitalize()).join(' ') }<br/>${ d.data.messages } Emails`);

    componentHandler.upgradeDom(null, 'mdl-tooltip');

    analysisTabs.style('display', 'block');
};
dataWorker.onerror = dataWorker.onmessageerror = console.error;

function updateCountUps() {
    loadingCountUps
        .transition()
        .countUp(d => d.length)
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
