const assign = require('object-assign');
const request = require('superagent');

const config = require('../config');

import { shallowClone } from 'utils/object-utils';

const TYPE = {
  kind_of_ballot_item: 'CANDIDATE'
};

function convertIdToWeVoteId (id) {
  return `wvtecand${id}`
}

// super private store holders
let _candidate_store = {};
let _ballot_candidate_map = {};

function getCandidatesByBallotId (office_we_vote_id, callback) {
    let count = 0;

    new Promise( (resolve, reject) => request
      .get(`${config.url}/candidatesRetrieve/`)
      .withCredentials()
      .query({ office_we_vote_id })
      .query({ office_id: ''})
      .end( (err, res) => {
        if (err || !res.body.success)
          reject(err);

        addCandidatesToStore(office_we_vote_id, res.body.candidate_list);

        resolve(res.body);
      })
    )
    .then ( getSupporters )
    .then ( getOpposition )
    .then( function (value) {
      callback(value);
    })
    .catch( err => {
        console.error(err);
    })
}

function addCandidatesToStore(ballot_id, candidate_list) {
    candidate_list.forEach(candidate => {
      _ballot_candidate_map[ballot_id] = _ballot_candidate_map[ballot_id] || [];
      _ballot_candidate_map[ballot_id].push(candidate.we_vote_id);

      _candidate_store[candidate.we_vote_id] = shallowClone(candidate);
    });
}

function getSupporters (value) {
  let count = 0;

  return new Promise ( (resolve, reject) => value
    .candidate_list.forEach( candidate => request
      .get(`${config.url}/positionSupportCountForBallotItem/`)
        .withCredentials()
        .query({ candidate_id: candidate.id})
        .end( (err, res) => {
          if (err)
            reject(err);

          value.candidate_list[count ++].supportCount = res.body.count;

          if (count === value.candidate_list.length)
            resolve(value);

        })
      )
  );
}

function getOpposition (value) {
  let count = 0;

  return new Promise ( (resolve, reject) => value
    .candidate_list.forEach( candidate => request
      .get(`${config.url}/positionOpposeCountForBallotItem/`)
        .withCredentials()
        .query({ candidate_id: candidate.id })
        .end( (err, res) => {
          if (err)
            reject(err);

          value.candidate_list[count ++].opposeCount = res.body.count;

          if (count === value.candidate_list.length)
            resolve(value);

        })
      )
  );
}

function getCandidateDetailsById (ballot_item_we_vote_id, callback) {
  request
    .get(`${config.url}/ballotItemRetrieve/`)
    .withCredentials()
    .query({ ballot_item_we_vote_id })
    .query( TYPE )
    .end( (err, res) => {
      if (err)
        throw err;

      addCandidateDetailsToStore(res.body)

      callback(res.body);
    });
}

function addCandidateDetailsToStore ( candidate ) {
  _candidate_store[candidate.we_vote_id] = shallowClone(candidate);
  _candidate_store[candidate.we_vote_id].detailsAdded = true;
}

const CandidateStore = {
  /**
   * return list of all candidates
   * @return {Array} array of candidates
   */
  getCandidateById: function (id, callback) {
    if (typeof id !== 'string')
      throw new Error('getCandidateByBallotId takes string id');

    if (typeof callback !== 'function')
      throw new Error('getCandidatesByBallotId takes callback function')

    id = convertIdToWeVoteId(id);

    return _candidate_store[id] && _candidate_store[id].detailsAdded ?
      callback(_candidate_store[id]) : getCandidateDetailsById(id, callback);
  },

  /**
   * return candidate object by id
   * @param  {Number} id candidate's we_vote_id
   * @return {Object}    candidate
   */
  getCandidatesByBallotId: function (id, callback) {
    if (typeof id !== 'string')
      throw new Error('getCandidateByBallotId takes string id');

    if (typeof callback !== 'function')
      throw new Error('getCandidatesByBallotId takes callback function')

    if ( _ballot_candidate_map[id] ) {
      callback({
        candidate_list: _ballot_candidate_map[id]
          .map( we_vote_id => _candidate_store[we_vote_id] )
      });
    }
    else
      getCandidatesByBallotId(id, callback);
  }
};

export default CandidateStore;
