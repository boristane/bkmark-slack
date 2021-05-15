import users from "./repositories/users";
import slackUsers from "./repositories/slack-users";
import collections from "./repositories/collections";

export default {
  ...users,
  ...slackUsers,
  ...collections,
}