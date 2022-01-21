import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises } from 'fs';
import dbClient from './db';
import redisClient from './redis';

const userTool = {
  async getCredentials(request) {
    const obj = { userId: null, key: null };
    const xToken = request.header('X-Token');
    if (!xToken) return obj;
    obj.key = `auth_${xToken}`;
    obj.userId = await redisClient.get(obj.key);
    return obj;
  },
  async getUser(query) {
    const user = await dbClient.usersCollection.findOne(query);
    return user;
  },
};

const fileTool = {
  async validateBody(request) {
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = request.body;
    const typesAllowed = ['file', 'image', 'folder'];
    let msg = null;
    if (!name) {
      msg = 'Missing name';
    } else if (!type || !typesAllowed.includes(type)) {
      msg = 'Missing type';
    } else if (!data && type !== 'folder') {
      msg = 'Missing data';
    } else if (parentId) {
      const file = await this.getFile({ _id: ObjectId(parentId) });
      if (!file) {
        msg = 'Parent not found';
      } else if (file.type !== 'folder') {
        msg = 'Parent is not a folder';
      }
    }
    const obj = {
      error: msg,
      fileParams: {
        name, type, parentId, isPublic, data,
      },
    };
    return obj;
  },

  async getFile(query) {
    const user = await dbClient.filesCollection.findOne(query);
    return user;
  },
  async saveFile(userId, fileParams, FOLDER_PATH) {
    const {
      name, type, isPublic, parentId, data,
    } = fileParams;
    const query = {
      userId, name, type, isPublic, parentId,
    };

    if (fileParams.type !== 'folder') {
      const fileNameUUID = uuidv4();
      const fileDataDecoded = Buffer.from(data, 'base64').toString('utf-8');
      const path = `${FOLDER_PATH}/${fileNameUUID}`;
      query.localPath = path;
      await promises.mkdir(FOLDER_PATH, { recursive: true });
      await promises.writeFile(path, fileDataDecoded);
    }
    const result = await dbClient.filesCollection.insertOne(query);
    delete query._id;
    delete query.localPath;
    const newFile = { id: result.insertedId, ...query };
    return newFile;
  },
};

export {
  userTool, fileTool,
};
