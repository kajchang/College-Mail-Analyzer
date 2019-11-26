let AGGREGATE_DATA = [];

const getHeader = (headers, name) => headers.find(header => header.name === name).value;

// Tries to identify the college the message is from
function findCollege(message) {
    const From = getHeader(message.result.payload.headers, 'From');
    const shortcuts = {
        'West Point Admissions <Admissions@usma-westpoint.org>': 'United States Military Academy'
    };
    if (shortcuts[From]) {
        return COLLEGE_DATA.find(datum => datum['institution.displayName'] === shortcuts[From])
    }
    let college;
    let match = /<[A-z0-9.-]+@([A-z0-9.-]+\.[A-z]+)>/g.exec(From);
    if (match) {
        const domainSegments = match[1].split('.');
        const domainName = domainSegments.slice(domainSegments.length - 2).join('.');
        college = COLLEGE_DATA.find(datum => {
            if (!datum['School Website']) return false;
            const match = /([A-z0-9.-]+\.[A-z]+)/g.exec(datum['School Website']);
            if (!match) return false;
            const schoolDomainSegments = match[1].split('.');
            const schoolDomainName = schoolDomainSegments.slice(schoolDomainSegments.length - 2).join('.');
            return schoolDomainName === domainName;
        });
    }
    if (!college) {
        match = /"?([A-z&',\- ]+)"? /.exec(From);
        if (match) {
            let schoolName = match[1];
            for (let extra of ['Admissions', 'Admission', 'Undergraduate', 'Summer Session', 'Office of', 'The']) {
                schoolName = schoolName.replace(extra, '');
            }
            schoolName = schoolName.trim();
            const schoolNameWords = schoolName.split(/[- ]/);

            college = COLLEGE_DATA
                .sort((a, b) => {
                    const aWords = a['institution.displayName'].split(/(?:--)| /);
                    const bWords = b['institution.displayName'].split(/(?:--)| /);

                    let diff = (schoolNameWords.filter(word => bWords.includes(word)).length / schoolNameWords.length) -
                               (schoolNameWords.filter(word => aWords.includes(word)).length / schoolNameWords.length);
                    if (diff === 0) {
                        diff = aWords.length - bWords.length;
                    }
                    return diff;
                })[0];
            const collegeNameWords = college['institution.displayName'].split(/(?:--)| /);
            if (collegeNameWords.length - 1 > collegeNameWords.filter(word => schoolNameWords.includes(word)).length) {
                college = undefined;
            }
        }
    }
    return college;
}

function analyzeData() {
    console.log('Starting Data Analysis!');
    for (let message of MESSAGE_DATA) {
        const college = findCollege(message);
        if (!college) {
            console.log('Not confident about ' + getHeader(message.result.payload.headers, 'From'));
            continue;
        }
        let match = AGGREGATE_DATA.find(datum => datum.college['institution.displayName'] === college['institution.displayName']);
        if (!match) {
            match = {
                college,
                messages: []
            };
            AGGREGATE_DATA.push(match);
        }
        match.messages.push(message);
    }
    AGGREGATE_DATA = AGGREGATE_DATA.sort((a, b) => b.messages.length - a.messages.length);
    clearResultsTable();
    insertResultRow({'School Name': true, 'Messages Sent': false}, true);
    for (let college of AGGREGATE_DATA) {
        insertResultRow([college.college['institution.displayName'], college.messages.length]);
    }
}
