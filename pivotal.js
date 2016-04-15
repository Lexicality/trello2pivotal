import request from 'request-promise';

const trackerURL = 'https://www.pivotaltracker.com/services/v5';

function magic(res) {
    if (!res.http_status) {
        return res;
    } else if (res.http_status < 300) {
        return res.data;
    }
    return Promise.reject(res.data);
}

export class PivotalClient {
    key = '';

    constructor(key) {
        if (!key) {
            throw new Error("Missing key!");
        }
        this.key = key;
    }

    request(uri, method, query, body, other) {
        return request({
            uri: trackerURL + (`/${uri}`.replace(/\/\//g, '/')),
            method,
            qs: {
                envelope: true,
                ...query,
            },
            body,
            headers: {
                'X-TrackerToken': this.key,
            },
            json: true,
            simple: false,
            ...other,
        }).then(magic);
    }

    get(uri, query, other) {
        return this.request(uri, 'GET', query, undefined, other);
    }

    post(uri, body, query, other) {
        return this.request(uri, 'POST', query, body, other);
    }

    put(uri, body, query, other) {
        return this.request(uri, 'PUT', query, body, other);
    }

    delete(uri, query, other) {
        return this.request(uri, 'GET', query, undefined, other);
    }
}

export default PivotalClient;

