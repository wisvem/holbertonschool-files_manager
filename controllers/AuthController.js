import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(request, response) {
    const Authorization = request.header('Authorization');
    if (!Authorization) return response.status(401).send({ error: 'Unauthorized' });
    const credentials = Authorization.split(' ')[1];
    if (!credentials) return response.status(401).send({ error: 'Unauthorized' });
    const decodedCredentials = Buffer.from(credentials, 'base64').toString(
      'utf-8',
    );
    const [email, password] = decodedCredentials.split(':');
    const sha1Password = sha1(password);
    const user = await dbClient.usersCollection.findOne({
      email,
      password: sha1Password,
    });
    if (!user) return response.status(401).send({ error: 'Unauthorized' });
    const token = uuidv4();
    const key = `auth_${token}`;
    const hoursForExpiration = 24;
    await redisClient.set(key, user._id.toString(), hoursForExpiration * 3600);
    return response.status(200).send({ token });
  }

  static async getDisconnect(request, response) {
    const xToken = request.header('X-Token');
    if (!xToken) return response.status(401).send({ error: 'Unauthorized' });
    const key = `auth_${xToken}`;
    const userId = await redisClient.get(key);
    if (!userId) return response.status(401).send({ error: 'Unauthorized' });
    await redisClient.del(key);
    return response.status(204).send();
  }

  static async getMe(request, response) {
    const xToken = request.header('X-Token');
    if (!xToken) return response.status(401).send({ error: 'Unauthorized' });
    const key = `auth_${xToken}`;
    const userId = await redisClient.get(key);
    if (!userId) return response.status(401).send({ error: 'Unauthorized' });
    const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
    delete user.password;
    return response.status(200).send(user);
  }
}

export default AuthController;
