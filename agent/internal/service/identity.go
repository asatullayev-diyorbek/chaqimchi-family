package service

// ServiceName is the stable Service Control Manager identifier. The legacy
// value is retained so earlier development installs upgrade in place rather
// than leave a second background service behind. It is not hidden: Windows
// shows DisplayName in its Services UI.
const ServiceName = "ChaqimchiFamilyAgent"

// DisplayName is the user-facing name displayed by Windows Services.
const DisplayName = "ChaqimchiAI Guard Service"
