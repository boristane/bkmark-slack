import users from "./repositories/users";
import slackUsers from "./repositories/slack-users";

export default {
  ...users,
  ...slackUsers,
}