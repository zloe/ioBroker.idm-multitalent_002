

const idm_protocol = {

  dataBlocks: new Map(),

  initialize: function() {
    const idm701100 = ['03', '04', '05', '06', '07', '08', '09', '0A', '0B'];

    this.dataBlocks.set('idm701100', idm701100);
  },

  getDataBlocks: function(version) {
    if (this.dataBlocks && this.dataBlocks.has(version)) {
      return this.dataBlocks.get(version);
    }
    return null;
  },

  ord: function(chr) { return chr.charCodeAt(0);},

  get_string: function(num) {
    var e, h, z;
    h = Math.floor(num / 100);
    z = Math.floor((num - h * 100) / 10);
    e = num % 10;
    return h.toString() + z.toString() + e.toString();
  },

  get_string_uint8array: function(data) {
      var text = "";
      for(var i = 0; i < data.byteLength; i++) {
          text = text + String.fromCharCode(data[i]);
      }
      return text;
  },

  calc_checksum: function(data) {
    var checksum = 0;


    for (var idx = 0; idx < data.length; idx += 1) {
      checksum = checksum ^ idm_protocol.ord(data[idx]);
    }

    return checksum;
  },

  read_val: function(length, data) {
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
  },

  create_message: function(data) {
    var checksum, checksumText, i, message;
    message = new Uint8Array(data.length + 6);
    message[0] = 1;
    i = 1;
    checksum = 0;

    for (var ch, idx = 0, data, len = data.length; idx < len; idx += 1) {
      ch = data[idx];
      message[i] = idm_protocol.ord(ch);
      i = i + 1;
      checksum = checksum ^ idm_protocol.ord(ch);
    }

    message[i] = 3;
    checksumText = idm_protocol.get_string(checksum);
    message[i + 1] = idm_protocol.ord(checksumText[0]);
    message[i + 2] = idm_protocol.ord(checksumText[1]);
    message[i + 3] = idm_protocol.ord(checksumText[2]);
    message[i + 4] = 4;
    return message;
  },

  received_data_packet : "",
  receive_state : 0,
  receive_chksum : "",

  reset: function() {
    idm_protocol.received_data_packet = "";
    idm_protocol.received_state = 0;
    idm_protocol.receive_chksum = "";
  },

  add_to_packet: function(received_data) {
    var chksum_c, chksum_r;
    received_data = idm_protocol.get_string_uint8array(received_data);

    for (var i = 0; i < received_data.length; i += 1) {
      var ch = received_data[i];

      if (idm_protocol.ord(ch) === 1) {
        if (idm_protocol.receive_state !== 0) {
          return 11;
        }

        idm_protocol.receive_state = 1;
      } else {
        if (idm_protocol.ord(ch) === 3) {
          if (idm_protocol.receive_state !== 1) {
            return 13;
          }

          idm_protocol.receive_state = 2;
        } else {
          if (idm_protocol.ord(ch) === 4) {
            if (idm_protocol.receive_state !== 2) {
              return 14;
            }

            if (idm_protocol.receive_chksum.length !== 3) {
              return 15;
            }

            chksum_c = idm_protocol.calc_checksum(idm_protocol.received_data_packet);
            chksum_r = idm_protocol.read_val(3, idm_protocol.receive_chksum);

            if (chksum_c !== chksum_r) {
              return 16;
            }

            idm_protocol.receive_state = 3;
            return idm_protocol.receive_state;
          } else {
            if (idm_protocol.receive_state === 1) {
              idm_protocol.received_data_packet = idm_protocol.received_data_packet + ch;
            }

            if (idm_protocol.receive_state === 2) {
              idm_protocol.receive_chksum = idm_protocol.receive_chksum + ch;
            }

            if (idm_protocol.receive_state === 3) {
              return 20;
            }
          }
        }
      }
    }

    return idm_protocol.receive_state;
  },

  print_hex: function(a) {
    for (var b, idx = 0, len = a.length; idx < len; idx += 1) {
      b = a[idx];
      console.log(b);
    }
  },

  get_data_packet: function() {
    if (idm_protocol.receive_state == 3) {
      return idm_protocol.received_data_packet;
    } else {
      return "";
    }
  },

  get_hex: function(ch) {
    if (ch >= "0" && ch <= "9") {
      return idm_protocol.ord(ch) - idm_protocol.ord("0");
    }

    if (ch >= "A" && ch <= "F") {
      return idm_protocol.ord(ch) - idm_protocol.ord("A") + 10;
    }

    return -1;
  },

  get_byte: function(data) {
    if (data.length < 2) {
      return -1;
    }

    return 16 * idm_protocol.get_hex(data[0]) + idm_protocol.get_hex(data[1]);
  },

  get_int: function(data) {
    if (data.length < 4) {
      return -1;
    }

    return idm_protocol.get_byte(data) + 256 * idm_protocol.get_byte(data.slice(2, 4));
  },

  get_text: function(data) {
    var text = "";
    var length = data.length/2;

    for (var i = 0; i < length; i += 1) {
      text = text + String.fromCharCode(idm_protocol.get_byte(data.slice(2 * i, 2 * i + 2)));
    }

    return text;
  },

  protocol_state: function(data) {
    if (!data || data.length < 4) return "E0";
    if (data.slice(0,4) === "01F2") {
      if (data.length < 8) return "E1"; // request data error
      if (data.slice(4,6) !== "00") return "E2" // request data - invalid response
      var block = idm_protocol.get_byte(data.slice(6,8));
      return "Data_Block_" + block.toString();
    }
    if (data.slice(0,4) === "01E0") return "I1"; // init ok
    if (data.length >= 6) {
      if (data.slice(0,6) === "01F100") return "R1"; // request data ok 
      if (data.slice(0,4) === "01E100") return "S1"; // set value OK
    }
    return "U1"; // unknown response
  },

  interpret_data: function(data) {
    var block, text;

    if (data.slice(0, 4) === "01E0") {
      // initial response message with version info
      text = "Version: " + idm_protocol.get_text(data.slice(4));
      return text;
    }

    if (data.slice(0, 6) === "01F100") {
      return "dataRequestOk";
    }

    if (data.slice(0, 4) !== "01F2") {
      return "invalid response";
    }

    if (data.slice(4, 6) !== "00") {
      return "error";
    }

    block = idm_protocol.get_byte(data.slice(6, 8));
    text = "Block: " + block.toString();

    if (block === 9 && data.length >= 26) {
      text = text + " min.Drehzahl Ladepumpe: " + idm_protocol.get_int(data.slice(8, 12)).toString();
      text = text + " " + idm_protocol.get_byte(data.slice(16, 18)).toString() + ":" + idm_protocol.get_byte(data.slice(14, 16)).toString() + ":" + idm_protocol.get_byte(data.slice(12, 14)).toString();
      text = text + " " + idm_protocol.get_byte(data.slice(18, 20)).toString() + "." + idm_protocol.get_byte(data.slice(20, 22)).toString() + "." + idm_protocol.get_int(data.slice(22, 26)).toString();
    } else {
      text = text + " " + idm_protocol.get_text(data.slice(8));
    }

    return text;
  }

}

module.exports = idm_protocol