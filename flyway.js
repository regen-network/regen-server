module.exports = function () {
  return {
    flywayArgs: {
      url: process.env.FLYWAY_URL || 'jdbc:postgresql:regen_registry',
      locations: 'filesystem:sql',
      user: process.env.FLYWAY_USER || 'postgres',
      password: process.env.FLYWAY_PASSWORD || 'postgres',
    },
    version: '9.0.4',
  };
};
