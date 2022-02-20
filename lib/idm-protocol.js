var net = require('net');

var BUFFER_SIZE;



BUFFER_SIZE = 1024;

function ord(chr) { return chr.charCodeAt(0);}

function get_string(num) {
  var e, h, z;
  h = Math.round(num / 100);
  z = Math.round((num - h * 100) / 10);
  e = num % 10;
  return h.toString() + z.toString() + e.toString();
}

function calc_checksum(data) {
  var checksum;
  checksum = 0;

  for (var ch, idx = 0, len = data.length; idx < len; idx += 1) {
    ch = data[idx];
    checksum = checksum ^ ord(ch);
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
  message = new ArrayBuffer(data.length + 6);
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
  message[i + 1] = checksumText[0];
  message[i + 2] = checksumText[1];
  message[i + 3] = checksumText[2];
  message[i + 4] = 4;
  return message;
}

function add_to_packet(packet_data, packet_chksum, state, received_data) {
  var chksum_c, chksum_r;

  for (var ch, idx = 0, len = received_data.length; idx < len; idx += 1) {
    ch = received_data[idx];

    if (ord(ch) === 1) {
      if (state !== 0) {
        return [packet_data, "", 11];
      }

      state = 1;
    } else {
      if (ord(ch) === 3) {
        if (state !== 1) {
          return [packet_data, "", 13];
        }

        state = 2;
      } else {
        if (ord(ch) === 4) {
          if (state !== 2) {
            return [packet_data, "", 14];
          }

          if (packet_chksum.length !== 3) {
            return [packet_data, "", 15];
          }

          chksum_c = calc_checksum(packet_data);
          chksum_r = read_val(3, packet_chksum);

          if (chksum_c !== chksum_r) {
            return [packet_data, "", 16];
          }

          state = 3;
          return [packet_data, packet_chksum, state];
        } else {
          if (state === 1) {
            packet_data = packet_data + ch;
          }

          if (state === 2) {
            packet_chksum = packet_chksum + ch;
          }

          if (state === 3) {
            return [packet_data, packet_chksum, 20];
          }
        }
      }
    }
  }

  return [packet_data, packet_chksum, state];
}

function print_hex(a) {
  for (var b, idx = 0, len = a.length; idx < len; idx += 1) {
    b = a[idx];
    console.log(b);
  }
}

function receive_packet(connection) {
  var received_data;
  var packet_data = "";
  var packet_checksum = "";
  var state = 0;
  var valid_states = new Set([0, 1, 2]);
  while (valid_states.has(state)) {
    received_data = connection.recv(BUFFER_SIZE);
    [packet_data, packet_checksum, state] = add_to_packet(packet_data, packet_checksum, state, received_data);
  }

  return [packet_data, packet_checksum, state];
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
