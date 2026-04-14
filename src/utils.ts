import { Connection } from './types.ts';

export function GetStatusColor(status: Connection['status']) {
  switch (status) {
    case 'authenticated':
      return 'lime';
    case 'connecting':
    case 'connected':
      return 'orange';
    case 'error':
    case 'disconnected':
      return 'red';
    default:
      return 'gray';
  }
}
