# Live StreamHUB

**Live StreamHUB** is an application that integrates with Overwolf to provide a HUB broadcast in OBS with in-game real-time statistics and analytics for spectator mode in League of Legends and CS2.

## Overview
Live StreamHUB enables broadcasters to create a fully customizable streaming HUB with dynamic in-game data integration. The system consists of a web application, an Overwolf-powered data client, and a server-side component.

## Features
- **Web Application**: Allows users to create and customize their streaming HUB.
- **Overwolf API**: A standalone application that fetches real-time game data.
- **Server-side**: **TODO**

## Prerequisites
Ensure you have the following installed on your machine:

- **Node.js**: [Download Node.js](https://nodejs.org/)
- **npm**: [Download npm](https://www.npmjs.com/)

Verify the installation by running:

```sh
npm -v && node -v
9.2.0
v18.19.1
```

## Getting Started
These instructions will help you set up the project on your local machine for development and testing.

### Installation
**Before installing**, make sure you meet the [prerequisites](#prerequisites).

Clone the repository and install dependencies:

```sh
git clone https://github.com/Tomas-Simoes/live-streamHUB
cd live-streamHUB/src/overwolf-api
npm install
```

## Usage
### Starting the Application

#### Overwolf API Module
To start the Overwolf API module, run:
```sh
# if you are in root directory
npm run start:overwolf

# if you are in src/overwolf-app directory
npm run build:start
```
This bundles everything related to Overwolf into `src/overwolf-api/.webpack`, structured as:
- `.webpack/main`: Core functionalities
- `.webpack/renderer`: Renderer HTML files

### Building the Application

#### Overwolf API Module
To create a production-ready build:
```sh
npm run make
```
This generates a `.deb` package for Linux distributions in `src/overwolf-api/out`.

## Built With
- **Electron.js**: For building the cross-platform desktop application that integrates with the Overwolf API.
- **Webpack**: For module bundling in both the web and desktop applications.

## Authors
- **Tomás Simões** - [GitHub](https://github.com/Tomas-Simoes)
- **Rafael** - [GitHub](https://github.com/Rafasta236)
- **Leonardo** - [GitHub](https://github.com/leorcf)

See the list of [contributors](https://github.com/your/project/contributors) who participated in this project.

## License
**TODO** - Specify the license under which the project is distributed.
