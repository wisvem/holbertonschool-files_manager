import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(request, response) {
    const { email, password } = request.body;
    if (!email) return response.status(400).send('Missing email');
    if (!password) return response.status(400).send('Missing password');
    const emailExists = await dbClient.usersCollection.findOne({ email });
    if (emailExists) return response.status(400).send('Already exist');
    const sha1Password = sha1(password);
    const result = await dbClient.usersCollection.insertOne({
      email,
      password: sha1Password,
    });
    const user = {
      id: result.insertedId,
      email,
    };
    return response.send(201, user);
  }
}

export default UsersController;
