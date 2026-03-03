
let _io = null;

const initSocket = (io) => { _io = io; };
const getIO      = ()     => _io;

module.exports = { initSocket, getIO };