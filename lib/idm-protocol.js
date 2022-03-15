//var net = require('net');

//var BUFFER_SIZE = 1024;


function ord(chr) { return chr.charCodeAt(0);}

function get_string(num) {
  var e, h, z;
  h = Math.floor(num / 100);
  z = Math.floor((num - h * 100) / 10);
  e = num % 10;
  return h.toString() + z.toString() + e.toString();
}

function get_string_uint8array(data) {
    var text = "";
    for(var i = 0; i < data.byteLength; i++) {
        switch(data[i]) {
          case 1: 
            text = text + '-START-';
            break;
          case 3:
            text = text + '-CHKSUM-';
            break;
          case 4:
            text = text + '-END-';
            break;      
          default:
            text = text + String.fromCharCode(data[i]);
            break;
        }
    }
    return text;
}

function calc_checksum(data) {
  var checksum = 0;


  for (var idx = 0; idx < data.length; idx += 1) {
    checksum = checksum ^ ord(data[idx]);
  }

  return checksum;
}

function read_val(length, data) {
  var factor, value;

  if (length === 0) {
    return 0;
  }

  if (data.length < length) {
    return 0;
  }

  factor = Math.pow(10, length - 1);
  value = 0;

  for (var i = 0; i < length; i += 1) {
    value = value + factor * Number.parseInt(data[i]);
    factor = factor / 10;
  }

  return value;
}

function create_message(data) {
  var checksum, checksumText, i, message;
  message = new Uint8Array(data.length + 6);
  message[0] = 1;
  i = 1;
  checksum = 0;

  for (var ch, idx = 0, data, len = data.length; idx < len; idx += 1) {
    ch = data[idx];
    message[i] = ord(ch);
    i = i + 1;
    checksum = checksum ^ ord(ch);
  }

  message[i] = 3;
  checksumText = get_string(checksum);
  message[i + 1] = ord(checksumText[0]);
  message[i + 2] = ord(checksumText[1]);
  message[i + 3] = ord(checksumText[2]);
  message[i + 4] = 4;
  return message;
}

var received_data_packet = "";
var receive_state = 0;
var receive_chksum = "";

function add_to_packet(received_data) {
  var chksum_c, chksum_r;

  for (var i = 0; i < received_data.length; i += 1) {
    var ch = received_data[i];

    if (ord(ch) === 1) {
      if (receive_state !== 0) {
        return 11;
      }

      receive_state = 1;
    } else {
      if (ord(ch) === 3) {
        if (receive_state !== 1) {
          return 13;
        }

        receive_state = 2;
      } else {
        if (ord(ch) === 4) {
          if (receive_state !== 2) {
            return 14;
          }

          if (receive_chksum.length !== 3) {
            return 15;
          }

          chksum_c = calc_checksum(received_data_packet);
          chksum_r = read_val(3, receive_chksum);

          if (chksum_c !== chksum_r) {
            return 16;
          }

          receive_state = 3;
          return receive_state;
        } else {
          if (receive_state === 1) {
            received_data_packet = received_data_packet + ch;
          }

          if (receive_state === 2) {
            receive_chksum = receive_chksum + ch;
          }

          if (receive_state === 3) {
            return 20;
          }
        }
      }
    }
  }

  return receive_state;
}

function print_hex(a) {
  for (var b, idx = 0, len = a.length; idx < len; idx += 1) {
    b = a[idx];
    console.log(b);
  }
}

function get_data_packet() {
  if (receive_state == 3) {
    return received_data_packet;
  } else {
    return "";
  }
}

function get_hex(ch) {
  if (ch >= "0" && ch <= "9") {
    return ord(ch) - ord("0");
  }

  if (ch >= "A" && ch <= "F") {
    return ord(ch) - ord("A") + 10;
  }

  return -1;
}

function get_byte(data) {
  if (data.length < 2) {
    return -1;
  }

  return 16 * get_hex(data[0]) + get_hex(data[1]);
}

function get_int(data) {
  if (data.length < 4) {
    return -1;
  }

  return get_byte(data) + 256 * get_byte(data.slice(2, 4));
}

function get_text(data, length) {
  var text;

  if (data.length < length * 2) {
    return "";
  }

  text = "";

  for (var i = 0, _pj_a = length; i < _pj_a; i += 1) {
    text = text + String.fromCharCode(get_byte(data.slice(2 * i, 2 * i + 2)));
  }

  return text;
}

function interpret_data(data) {
  var block, text;

  if (data.slice(0, 4) !== "01F2") {
    return "invalid response";
  }

  if (data.slice(4, 6) !== "00") {
    return "error";
  }

  block = get_byte(data.slice(6, 8));
  text = "Block: " + block.toString();

  if (block === 9 && data.length >= 26) {
    text = text + " min.Drehzahl Ladepumpe: " + get_int(data.slice(8, 12)).toString();
    text = text + " " + get_byte(data.slice(16, 18)).toString() + ":" + get_byte(data.slice(14, 16)).toString() + ":" + get_byte(data.slice(12, 14)).toString();
    text = text + " " + get_byte(data.slice(18, 20)).toString() + "." + get_byte(data.slice(20, 22)).toString() + "." + get_int(data.slice(22, 26)).toString();
  }

  return text;
}

