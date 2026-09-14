package service

// ServiceName is the stable Service Control Manager identifier. It is not
// hidden: Windows shows DisplayName in its Services UI.
const ServiceName = "Spino24Agent"

// LegacyServiceName is what ServiceName was called before the ChaqimchiAI
// -> Spino24 rebrand. cmd/installer checks for a service still registered
// under this name and migrates it (same device credentials, removed
// instead of left running) so an already-installed beta tester's machine
// ends up with exactly one agent service, not two.
const LegacyServiceName = "ChaqimchiFamilyAgent"

// DisplayName is the user-facing name displayed by Windows Services.
const DisplayName = "Spino24 Guard Service"
