![Logo](admin/idm-multitalent_002.png)

 **Attention!** This is an open source adapter from an individual that is not related to the manufacturer, no warranty or guarantees! 
 
 Still the manufacturer agreed to the publishing of this work.

***You might loose warranty from the manufacturer!***
# ioBroker.idm-multitalent_002
[![NPM version](https://img.shields.io/npm/v/iobroker.idm-multitalent_002.svg)](https://www.npmjs.com/package/iobroker.idm-multitalent_002)
[![Downloads](https://img.shields.io/npm/dm/iobroker.idm-multitalent_002.svg)](https://www.npmjs.com/package/iobroker.idm-multitalent_002)
![Number of Installations](https://iobroker.live/badges/idm-multitalent_002-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/idm-multitalent_002-stable.svg)
<!--[![Dependency Status](https://img.shields.io/david/zloe/iobroker.idm-multitalent_002.svg)](https://david-dm.org/zloe/iobroker.idm-multitalent_002)
-->
[![NPM](https://nodei.co/npm/iobroker.idm-multitalent_002.png?downloads=true)](https://nodei.co/npm/iobroker.idm-multitalent_002/)

**Tests:** ![Test and Release](https://github.com/zloe/ioBroker.idm-multitalent_002/workflows/Test%20and%20Release/badge.svg)

## idm-multitalent_002 adapter for ioBroker
Read sensor data and read and write settings of a iDM heatpump with multitalent.002 control.

Currently following versions are supported:
* TERRA050701  - idm701 (idm701100)... mostly supported, one installation, running since April 6th, 2022
* TERRA061001  - idm712 (idm712100)... supported, one experimental installation
* EVR-II071102 - idm750 (idm750100)... experimentally, no known installation, issues with data definitions
* EVR-II100201 - EVR752 (EVR752101)... support in development currently, ATTENTION: unstable as of May 2023

You need a Ethernet to RS422 converter to connect to the multitalent control.
**Note** that you have to connect ground/shield of your converter to the ground of the control/heatpump in order to prevent electric influences on the sensor readings.
The values are read all 30 seconds. As the control is quite picky on the timing this is the fastest suggested polling time.
The changed values are also transferred once all 30 seconds (exactly before the values are read) to the control.

During bootup of the control (e.g. after a power loss) no values should be polled from the control. This is currently **NOT** ensured by the adapter. So you **manually** need to **stop** it. If the control of the heatpump did not start due to the adapter then simply stop the adapter and power cycle the control. This should fix the problem. Afterwards you can start the adapter again. I implemented a delayed switch-on of the serial server. This also mitigates the problem.

Example installation:

![system overview](idm%20RS422%20Anschluss.drawio.png)

Settings of the serial adapter:
```
 Baud Rate(bps) 19200
 Parity         Even
 Data Bit       8
 Stop Bit       1
 Flow Control   None
 UART FIFO      Disable
```
## Changelog
### **WORK IN PROGRESS**
* (zloe) ongoing work on EVR752101
* (zloe) updated dependencies, dropped support for nodejs 14

### 0.2.6 (2023-05-06)
* (zloe) allowing more values to be written
* (zloe) more unit tests

### 0.2.5 (2023-05-05)
* (zloe) further fixing for version EVR752101, datablock definition fixes

### 0.2.4 (2023-05-03)
* (zloe) further fixing for version EVR752101

### 0.2.3 (2023-05-03)
* (zloe) further fixing for version EVR752101

### 0.2.2 (2023-05-01)
* (zloe) fixed an issue writing values introduced with 0.2.0
* (zloe) updating dependencies
* (zloe) further fixing for version EVR752101

### 0.2.1 (2023-04-30)
* (zloe) fixed padding in datablock 7 for version IDM712100

### 0.2.0 (2023-04-30)
* (zloe) added experimental support for version EVR752101
* (zloe) fixed bug with signed values

### 0.1.2 (2022-04-17)
* (zloe) refactoring

### 0.1.1 (2022-04-17)
* (zloe) improved error and reconnect handling

### 0.1.0 (2022-04-10)
* (zloe) request static data at a different (less frequent) interval or when changes are sent to the control
* (zloe) first running version, still missing proper error handling
* (zloe) do not use custom state parameters as they are overwritten in some circumstances (i do not yet understand how to do this properly)

### 0.0.2 (2022-02-19)
* (zloe) initial release

## License
MIT License

Copyright (c) 2023 zloe <klaus@zloebl.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Installation
As the adapter is not (yet) listed in the official ioBroker repository you have to download the tgz file from here (github or npmjs).
1. Upload the file to your ioBroker host
1. Install it locally (The paths are different on Windows):
    ```bash
    cd /opt/iobroker
    npm i /path/to/tarball.tgz
    ```

## Developer manual
Missing documentation about the data structures/blocks.

Attention, still experimental, ... the adapter sets values of the heatpump, so do not install, unless you know what you are doing and contacted the author! 

### Getting started

You are almost done, only a few steps left:
1. Create a new repository on GitHub with the name `ioBroker.idm-multitalent_002`
1. Initialize the current folder as a new git repository:  
    ```bash
    git init -b main
    git add .
    git commit -m "Initial commit"
    ```
1. Link your local repository with the one on GitHub:  
    ```bash
    git remote add origin https://github.com/zloe/ioBroker.idm-multitalent_002
    ```

1. Push all files to the GitHub repo:  
    ```bash
    git push origin main
    ```

1. Head over to [main.js](main.js) and start programming!

### Best Practices
We've collected some [best practices](https://github.com/ioBroker/ioBroker.repositories#development-and-coding-best-practices) regarding ioBroker development and coding in general. If you're new to ioBroker or Node.js, you should
check them out. If you're already experienced, you should also take a look at them - you might learn something new :)

### Scripts in `package.json`
Several npm scripts are predefined for your convenience. You can run them using `npm run <scriptname>`
| Script name | Description |
|-------------|-------------|
| `test:js` | Executes the tests you defined in `*.test.js` files. |
| `test:package` | Ensures your `package.json` and `io-package.json` are valid. |
| `test:unit` | Tests the adapter startup with unit tests (fast, but might require module mocks to work). |
| `test:integration` | Tests the adapter startup with an actual instance of ioBroker. |
| `test` | Performs a minimal test run on package files and your tests. |
| `check` | Performs a type-check on your code (without compiling anything). |
| `lint` | Runs `ESLint` to check your code for formatting errors and potential bugs. |
| `release` | Creates a new release, see [`@alcalzone/release-script`](https://github.com/AlCalzone/release-script#usage) for more details. |

### Writing tests
When done right, testing code is invaluable, because it gives you the 
confidence to change your code while knowing exactly if and when 
something breaks. A good read on the topic of test-driven development 
is https://hackernoon.com/introduction-to-test-driven-development-tdd-61a13bc92d92. 
Although writing tests before the code might seem strange at first, but it has very 
clear upsides.

The template provides you with basic tests for the adapter startup and package files.
It is recommended that you add your own tests into the mix.

### Publishing the adapter
Using GitHub Actions, you can enable automatic releases on npm whenever you push a new git tag that matches the form 
`v<major>.<minor>.<patch>`. We **strongly recommend** that you do. The necessary steps are described in `.github/workflows/test-and-release.yml`.

Since you installed the release script, you can create a new
release simply by calling:
```bash
npm run release
```
Additional command line options for the release script are explained in the
[release-script documentation](https://github.com/AlCalzone/release-script#command-line).

To get your adapter released in ioBroker, please refer to the documentation 
of [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories#requirements-for-adapter-to-get-added-to-the-latest-repository).

### Test the adapter manually on a local ioBroker installation
In order to install the adapter locally without publishing, the following steps are recommended:
1. Create a tarball from your dev directory:  
    ```bash
    npm pack
    ```
1. Upload the resulting file to your ioBroker host
1. Install it locally (The paths are different on Windows):
    ```bash
    cd /opt/iobroker
    npm i /path/to/tarball.tgz
    ```

For later updates, the above procedure is not necessary. Just do the following:
1. Overwrite the changed files in the adapter directory (`/opt/iobroker/node_modules/iobroker.idm-multitalent_002`)
1. Execute `iobroker upload idm-multitalent_002` on the ioBroker host

Copyright (c) 2023 zloe <klaus@zloebl.net>
