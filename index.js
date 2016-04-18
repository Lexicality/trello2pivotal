import Q from 'q';
import * as fs from 'fs';
import * as toml from 'toml';
import _ from 'lodash';

import Trello from 'node-trello';
import { PivotalClient as Pivotal } from './pivotal';

const config = toml.parse(fs.readFileSync('config.toml'));

Q.longStackSupport = true;

let memberMap = new Map();

function storyify(card) {
    let story = {
        name: card.name,
        description: card.desc,
        story_type: 'feature',
        labels: [],
    };
    for (let label of card.labels) {
        switch (label.name) {
        case 'Urgent to be done':
        case 'Needs to be done':
            story.current_state = 'unstarted';
            break;
        case 'Good idea to do':
        case 'Nice to do':
        case 'Icebox':
            story.current_state = 'unscheduled';
            break;
        case 'Bug':
            story.story_type = 'bug';
            break;
        default:
            story.labels.push({ name: label.name });
        }
    }
    for (let action of card.actions) {
        if (action.type === 'createCard') {
            story.created_at = action.date;
            if (memberMap.has(action.idMemberCreator)) {
                story.requested_by_id = memberMap.get(action.idMemberCreator);
            }
        }
    }
    // if (card.due) {
        // story.deadline = card.due;
    // }
    story.owner_ids = card.idMembers.map((id) => memberMap.get(id)).filter(_.identity).slice(0, 3);

    console.log('Result:');
    console.dir(story);
    console.log();

    return story;
}

function nameContains(a, b) {
    return a.indexOf(b) !== -1;
}


async function fn2() {
    let trelloAPI = new Trello(config.trello.key, config.trello.token);
    let pivotalAPI = new Pivotal(config.pivotal.token);

    const trelloGet = Q.nbind(trelloAPI.get, trelloAPI);

    const ptLogin = trelloGet('/1/members/me').then((me) => console.info("Logged in to trello as %s!", me.fullName));
    const ppLogin = pivotalAPI.get('/me').then((me) => console.info("Logged into Pivotal as %s!", me.name));

    await Q.all([ptLogin, ppLogin]);

    const boardURL = `/1/boards/${config.trello.board}`;
    const projectURL = `/projects/${config.pivotal.project}`;

    const ptMembers = trelloGet(`${boardURL}/members`, { fields: 'fullName' });
    const ppMembers = pivotalAPI.get(`${projectURL}/memberships`, { fields: 'person(name)' }).then((members) => _.map(members, 'person'));

    const [trelloMembers, pivotalMembers] = await Promise.all([ptMembers, ppMembers]);

    for (let tMember of trelloMembers) {
        let tName = tMember.fullName.toLowerCase();
        for (let pMember of pivotalMembers) {
            let pName = pMember.name.toLowerCase();
            if (tName === pName || nameContains(tName, pName) || nameContains(pName, tName)) {
                memberMap.set(tMember.id, pMember.id);
                pivotalMembers.splice(pivotalMembers.indexOf(pMember), 1);
                console.info("Matched Trello user %s (%s) with Pivotal User %s (%s)!", tName, tMember.id, pName, pMember.id);
                break;
            }
        }
    }

    let cards = trelloGet(`${boardURL}/cards/visible/`, {
        attachments: true,
        actions: [
            'commentCard',
            'createCard',
        ].join(','),
    })
        .then((ret) => ret.filter((card) => _.includes(config.trello.lists, card.idList)));

    for (let card of await cards) {
        console.info(card);
        // console.dir(card.actions[0]);
        // break;
        console.log();
        console.info('Transfering across card "%s"!', card.name);
        let story = await pivotalAPI.post(`${projectURL}/stories`, storyify(card));
        console.info('Created story %s!', story.id);
        const storyURL = `${projectURL}/stories/${story.id}`;

        // Comments
        for (let comment of _.filter(card.actions, { type: 'commentCard' })) {
            // console.dir(comment);
            const { idMemberCreator: tMember, data: { text } } = comment;
            let pComment = await pivotalAPI.post(`${storyURL}/comments`, {
                text,
                person_id: memberMap.get(tMember),
            });
            console.info("Created comment %s!", pComment.id);
        }

        break;
    }
}

(async function() {
    try {
        await fn2();
    } catch (e) {
        console.error('Something went wrong: ', e);
    }
})();
