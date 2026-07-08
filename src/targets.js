// Edit this list to monitor different things in different deployments of this
// same Worker -- nothing else in this project is specific to any one app.
export const TARGETS = [
    { name: "Shenzhen - forward (443)", host: "shenzhen.1000600.xyz", port: 443 },
    { name: "Shenzhen - reverse (8443)", host: "shenzhen.1000600.xyz", port: 8443 },
    { name: "Singapore - forward (443)", host: "singapore.1000600.xyz", port: 443 },
    { name: "Singapore - reverse (8443)", host: "singapore.1000600.xyz", port: 8443 },
    { name: "Singapore - direct (8444)", host: "singapore.1000600.xyz", port: 8444 },
];
