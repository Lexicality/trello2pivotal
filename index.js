import Q, { ninvoke } from 'q';
import * as fs from 'fs';
import * as toml from 'toml';

import Trello from 'node-trello';
import { Client as Pivotal } from 'pivotaltracker';

const config = toml.parse(fs.readFileSync('config.toml'));

Q.longStackSupport = true;

// const peopleMap = { };

let trelloAPI = new Trello(config.trello.key, config.trello.token);
let pivotalAPI = new Pivotal(config.pivotal.token);

const trelloGet = Q.nbind(trelloAPI.get, trelloAPI);
trelloGet('/1/members/me').then((me) => console.info("Logged in to trello as %s!", me.fullName)).done();

const pivotalProject = pivotalAPI.project(config.pivotal.project);

ninvoke(pivotalProject, 'get')
    .then((me) => {
        console.info(me);
    })
    .catch((wut) => console.error("Could not pivotal", wut))
    .done();
