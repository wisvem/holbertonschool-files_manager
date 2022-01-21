import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises } from 'fs';
import dbClient from './db';
import redisClient from './redis';

const mongoCheck = {
  isValidId(id) {
    // Checks if Id is Valid for Mongo
    try {
      ObjectId(id);
    } catch (err) {
      return false;
    }
    return true;
  },
};

const userTool = {
  async getCredentials(request) {
    const credential = { userId: null, key: null };
    const xToken = request.header('X-Token');
    if (!xToken) return credential;
    credential.key = `auth_${xToken}`;
    credential.userId = await redisClient.get(credential.key);
    return credential;
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
    } else if (parentId && parentId !== '0') {
      const file = await this.getFile({ _id: ObjectId(parentId) });
      if (!file) {
        msg = 'Parent not found';
      } else if (file.type !== 'folder') {
        msg = 'Parent is not a folder';
      }
    }
    const file = {
      error: msg,
      fileParams: {
        name, type, parentId, isPublic, data,
      },
    };
    return file;
  },
  async getFile(query) {
    const file = await dbClient.filesCollection.findOne(query);
    return file;
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
      try {
        await promises.mkdir(FOLDER_PATH, { recursive: true });
        await promises.writeFile(path, fileDataDecoded);
      } catch (err) {
        return { error: err.message, code: 400 };
      }
    }
    const result = await dbClient.filesCollection.insertOne(query);
    const file = this.processFile(query);
    const newFile = { id: result.insertedId, ...file };
    return { error: null, newFile };
  },
  async updateFile(query, set) {
    const fileList = await dbClient.filesCollection.findOneAndUpdate(
      query, set, { returnOriginal: false },
    );
    return fileList;
  },
  async getFilesOfParentId(query) {
    const fileList = await dbClient.filesCollection.aggregate(query);
    return fileList;
  },
  async publishUnpublish(request, setPublish) {
    const { id: fileId } = request.params;
    if (mongoCheck.isValidId(fileId)) return { error: 'Unauthorized', code: 401 };
    const { userId } = await userTool.getUserIdAndKey(request);
    const user = await userTool.getUser({ _id: ObjectId(userId) });
    if (!user) return { error: 'Unauthorized', code: 401 };
    const file = await this.getFile({ _id: ObjectId(fileId), userId });
    if (!file) return { error: 'Not found', code: 404 };
    const result = await this.updateFile(
      { _id: ObjectId(fileId), userId }, { $set: { isPublic: setPublish } },
    );
    const {
      _id: id, userId: resultUserId, name, type, isPublic, parentId,
    } = result.value;
    const updatedFile = {
      id, userId: resultUserId, name, type, isPublic, parentId,
    };
    return { error: null, code: 200, updatedFile };
  },

  processFile(doc) {
    const file = { id: doc._id, ...doc };
    delete file.localPath;
    delete file._id;
    return file;
  },
  isOwnerAndPublic(file, userId) {
    if ((!file.isPublic && !userId) || (userId && file.userId !== userId)) return false;
    return true;
  },
  async getFileData(file) {
    const { localPath } = file;
    let data;
    try {
      data = await promises.readFile(localPath);
      data = data.toString();
    } catch (err) {
      return { error: 'Not found', code: 404 };
    }
    return { data };
  },
};

export {
  userTool, fileTool, mongoCheck,
};
