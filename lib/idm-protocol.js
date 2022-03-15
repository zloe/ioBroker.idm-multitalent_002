

const idm_protocol = {

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
          switch(data[i]) {
            case 551: 
              text = text + '-START-';
              break;
            case 553:
              text = text + '-CHKSUM-';
              break;
            case 554:
              text = text + '-END-';
              break;      
            default:
              text = text + String.fromCharCode(data[i]);
              break;
          }
      }
      return text;
  },

  calc_checksum: function(data) {
    var checksum = 0;


    for (var idx = 0; idx < data.length; idx += 1) {
      checksum = checksum ^ this.ord(data[idx]);
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
      message[i] = this.ord(ch);
      i = i + 1;
      checksum = checksum ^ this.ord(ch);
    }

    message[i] = 3;
    checksumText = this.get_string(checksum);
    message[i + 1] = this.ord(checksumText[0]);
    message[i + 2] = this.ord(checksumText[1]);
    message[i + 3] = this.ord(checksumText[2]);
    message[i + 4] = 4;
    return message;
  },

  received_data_packet : "",
  receive_state : 0,
  receive_chksum : "",

  reset: function() {
    this.received_data_packet = "";
    this.received_state = 0;
    this.receive_chksum = "";
  },

  add_to_packet: function(received_data) {
    var chksum_c, chksum_r;
    received_data = this.get_string_uint8array(received_data);

    for (var i = 0; i < received_data.length; i += 1) {
      var ch = received_data[i];

      if (this.ord(ch) === 1) {
        if (this.receive_state !== 0) {
          return 11;
        }

        this.receive_state = 1;
      } else {
        if (this.ord(ch) === 3) {
          if (this.receive_state !== 1) {
            return 13;
          }

          this.receive_state = 2;
        } else {
          if (this.ord(ch) === 4) {
            if (this.receive_state !== 2) {
              return 14;
            }

            if (this.receive_chksum.length !== 3) {
              return 15;
            }

            chksum_c = this.calc_checksum(this.received_data_packet);
            chksum_r = this.read_val(3, this.receive_chksum);

            if (chksum_c !== chksum_r) {
              return 16;
            }

            this.receive_state = 3;
            return this.receive_state;
          } else {
            if (this.receive_state === 1) {
              this.received_data_packet = this.received_data_packet + ch;
            }

            if (this.receive_state === 2) {
              this.receive_chksum = this.receive_chksum + ch;
            }

            if (this.receive_state === 3) {
              return 20;
            }
          }
        }
      }
    }

    return this.receive_state;
  },

  print_hex: function(a) {
    for (var b, idx = 0, len = a.length; idx < len; idx += 1) {
      b = a[idx];
      console.log(b);
    }
  },

  get_data_packet: function() {
    if (this.receive_state == 3) {
      return this.received_data_packet;
    } else {
      return "";
    }
  },

  get_hex: function(ch) {
    if (ch >= "0" && ch <= "9") {
      return this.ord(ch) - this.ord("0");
    }

    if (ch >= "A" && ch <= "F") {
      return this.ord(ch) - this.ord("A") + 10;
    }

    return -1;
  },

  get_byte: function(data) {
    if (data.length < 2) {
      return -1;
    }

    return 16 * this.get_hex(data[0]) + this.get_hex(data[1]);
  },

  get_int: function(data) {
    if (data.length < 4) {
      return -1;
    }

    return this.get_byte(data) + 256 * this.get_byte(data.slice(2, 4));
  },

  get_text: function(data, length) {
    var text;

    if (data.length < length * 2) {
      return "";
    }

    text = "";

    for (var i = 0, _pj_a = length; i < _pj_a; i += 1) {
      text = text + String.fromCharCode(this.get_byte(data.slice(2 * i, 2 * i + 2)));
    }

    return text;
  },

  interpret_data: function(data) {
    var block, text;

    if (data.slice(0, 4) !== "01F2") {
      return "invalid response";
    }

    if (data.slice(4, 6) !== "00") {
      return "error";
    }

    block = this.get_byte(data.slice(6, 8));
    text = "Block: " + block.toString();

    if (block === 9 && data.length >= 26) {
      text = text + " min.Drehzahl Ladepumpe: " + this.get_int(data.slice(8, 12)).toString();
      text = text + " " + this.get_byte(data.slice(16, 18)).toString() + ":" + this.get_byte(data.slice(14, 16)).toString() + ":" + this.get_byte(data.slice(12, 14)).toString();
      text = text + " " + this.get_byte(data.slice(18, 20)).toString() + "." + this.get_byte(data.slice(20, 22)).toString() + "." + this.get_int(data.slice(22, 26)).toString();
    }

    return text;
  }

}

module.exports = idm_protocol