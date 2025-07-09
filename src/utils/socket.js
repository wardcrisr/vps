import { io } from 'socket.io-client';

// 默认连接到当前主机的同源端口
const socket = io('/', {
  transports: ['websocket'],
});

export default socket; 