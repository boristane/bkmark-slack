import users from "./repositories/users";
import slackUsers from "./repositories/slack-users";
import collections from "./repositories/collections";
import slackInstallation from "./repositories/slack-installations";

export default {
  ...users,
  ...slackUsers,
  ...collections,
  ...slackInstallation,
}