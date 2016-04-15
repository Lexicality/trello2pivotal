import Q from 'q';
import * as fs from 'fs';
import * as toml from 'toml';
import _ from 'lodash';

import Trello from 'node-trello';
import { PivotalClient as Pivotal } from './pivotal';


const config = toml.parse(fs.readFileSync('config.toml'));

Q.longStackSupport = true;


function storyify(card) {
    return {
        name: card.name,
        description: card.desc,
        story_type: 'feature',
    };
}


async function fn2() {
    let trelloAPI = new Trello(config.trello.key, config.trello.token);
    let pivotalAPI = new Pivotal(config.pivotal.token);

    const trelloGet = Q.nbind(trelloAPI.get, trelloAPI);

    const ptLogin = trelloGet('/1/members/me').then((me) => console.info("Logged in to trello as %s!", me.fullName));
    const ppLogin = pivotalAPI.get('/me').then((me) => console.info("Logged into Pivotal as %s!", me.name));

    await Q.all([ptLogin, ppLogin]);

    let cards = trelloGet(`/1/boards/${config.trello.board}/cards/visible/`)
        .then((ret) => ret.filter((card) => _.includes(config.trello.lists, card.idList)));

    for (let card of await cards) {
        console.info('Transfering across card "%s"!', card.name);
        let story = await pivotalAPI.post(`/projects/${config.pivotal.project}/stories`, storyify(card));
        console.info('Created story %s!', story.id);
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
