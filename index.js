import Q from 'q';
import * as fs from 'fs';
import * as toml from 'toml';
import _ from 'lodash';

import Trello from 'node-trello';
import { PivotalClient as Pivotal } from './pivotal';


const config = toml.parse(fs.readFileSync('config.toml'));

Q.longStackSupport = true;

/*
[ 'Needs to be done',
  'Code Quality',
  'Responsiveness',
  'Nice to do',
  'Good idea to do',
  'Urgent to be done',
  'Visuals',
  'Bug',
  'Usability issue',
  'Icebox' ]
*/

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
        case 'Code Quality':
            story.story_type = 'chore';
            break;
        case 'Bug':
            story.story_type = 'bug';
            break;
        default:
            story.labels.push({ name: label.name });
        }
    }
    return story;
}

// function determineTrelloLabels(labels) {
    // console.log(_.map(labels, 'name'));
    // return {
        // decorative: {},
        // prios: {},
    // };
// }



async function fn2() {
    let trelloAPI = new Trello(config.trello.key, config.trello.token);
    let pivotalAPI = new Pivotal(config.pivotal.token);

    const trelloGet = Q.nbind(trelloAPI.get, trelloAPI);

    const ptLogin = trelloGet('/1/members/me').then((me) => console.info("Logged in to trello as %s!", me.fullName));
    const ppLogin = pivotalAPI.get('/me').then((me) => console.info("Logged into Pivotal as %s!", me.name));

    await Q.all([ptLogin, ppLogin]);

    const boardURL = `/1/boards/${config.trello.board}`;

    // await trelloGet(boardURL + '/labels').then(determineTrelloLabels);

    let cards = trelloGet(`${boardURL}/cards/visible/`)
        .then((ret) => ret.filter((card) => _.includes(config.trello.lists, card.idList)));

    for (let card of await cards) {
        // console.info(card);
        console.info('Transfering across card "%s"!', card.name);
        let story = await pivotalAPI.post(`/projects/${config.pivotal.project}/stories`, storyify(card));
        console.info('Created story %s!', story.id);
        // break;
    }

    // console.info('Got #%d cards from trello!', cards.length);
}

(async function() {
    try {
        await fn2();
    } catch (e) {
        console.error('Something went wrong: ', e);
    }
})();
