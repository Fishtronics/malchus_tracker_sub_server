export interface Credentials {
  username: string;
  password: string;
}

export enum Command {
  CMD_MOUSE_MOVE = 'mouse_move',
  CMD_MOUSE_CLICK = 'mouse_click',
  CMD_MOUSE_SCROLL = 'mouse_scroll',
  CMD_TYPING = 'typing',
  CMD_COPY = 'copy',
  CMD_ENTER = 'enter',
  CMD_SELECT_ALL = 'select_all',
  CMD_DELETE = 'delete',
  CMD_BACKSPACE = 'backspace',
  CMD_TAB = 'tab',
  CMD_ESCAPE = 'escape',
  CMD_SPACE = 'space',
  CMD_ARROW_UP = 'arrow_up',
  CMD_ARROW_DOWN = 'arrow_down',
  CMD_ARROW_LEFT = 'arrow_left',
  CMD_ARROW_RIGHT = 'arrow_right',
  CMD_PAGE_UP = 'page_up',
  CMD_PAGE_DOWN = 'page_down',
  
}

export interface ArduinoCommand {
  command: Command;
  credentials?: Credentials;
  x?: number;
  y?: number;
  scrollAmount?: number;
  text?: string;
  mouseSetting?: {
    resolutionWidth: string,
    resolutionHeight: string,
    correctionFactor: string
  };
}

export interface ArduinoResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number;
}

export const MSG_TYPES = {
  ACK: 'ack',
  ERROR: 'error',
  STATUS: 'status',
  RESULT: 'result'
} as const;

export interface ArduinoMessage {
  type: typeof MSG_TYPES[keyof typeof MSG_TYPES];
  success: boolean;
  message: string;
  data?: any;
}