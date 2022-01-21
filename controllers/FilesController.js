import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import { userTool, fileTool, mongoCheck } from '../utils/shared';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(request, response) {
    const { userId } = await userTool.getCredentials(request);
    const user = await userTool.getUser({ _id: ObjectId(userId) });
    if (!user) return response.status(401).send({ error: 'Unauthorized' });
    const { error: validationError, fileParams } = await fileTool.validateBody(
      request,
    );
    if (validationError) return response.status(400).send({ error: validationError });
    const { error, code, newFile } = await fileTool.saveFile(
      userId, fileParams, FOLDER_PATH,
    );

    if (error) return response.status(code).send(error);
    return response.status(201).send(newFile);
  }

  static async getShow(request, response) {
    const fileId = request.params.id;
    const { userId } = await userTool.getCredentials(request);
    const user = await userTool.getUser({ _id: ObjectId(userId) });
    if (!user) return response.status(401).send({ error: 'Unauthorized' });
    if (!mongoCheck.isValidId(fileId)) return response.status(404).send({ error: 'Not found' });
    const fileTmp = await fileTool.getFile({ _id: ObjectId(fileId), userId });
    if (!fileTmp) return response.status(404).send({ error: 'Not found' });
    const file = { id: fileTmp._id, ...fileTmp };
    return response.status(200).send(file);
  }

  static async getIndex(request, response) {
    const { userId } = await userTool.getCredentials(request);
    const user = await userTool.getUser({ _id: ObjectId(userId) });
    if (!user) return response.status(401).send({ error: 'Unauthorized' });
    let parentId = request.query.parentId || 0;
    if (parentId === '0') parentId = 0;
    let page = Number(request.query.page) || 0;
    if (Number.isNaN(page)) page = 0;
    if (parentId !== 0) {
      const folder = await fileTool.getFile({ _id: ObjectId(parentId) });
      if (!folder || folder.type !== 'folder') return response.status(200).send([]);
    }
    const pipeline = [{ $match: { parentId } }, { $skip: page * 20 }, { $limit: 20 }];
    const fileCursor = await fileTool.getFilesOfParentId(pipeline);
    const fileList = [];
    await fileCursor.forEach((doc) => {
      const document = fileTool.processFile(doc);
      fileList.push(document);
    });
    return response.status(200).send(fileList);
  }

  static async putPublish(request, response) {
    const { error, code, updatedFile } = await fileTool.publishUnpublish(
      request, true,
    );
    if (error) return response.status(code).send({ error });
    return response.status(code).send(updatedFile);
  }

  static async putUnpublish(request, response) {
    const { error, code, updatedFile } = await fileTool.publishUnpublish(
      request, false,
    );
    if (error) return response.status(code).send({ error });
    return response.status(code).send(updatedFile);
  }

  static async getFile(request, response) {
    const { userId } = await userTool.getCredentials(request);
    const { id: fileId } = request.params;
    if (!mongoCheck.isValidId(fileId)) return response.status(404).send({ error: 'Not found' });
    const file = await fileTool.getFile({
      _id: ObjectId(fileId),
    });
    if (!file || !fileTool.isOwnerAndPublic(file, userId)) return response.status(404).send({ error: 'Not found' });
    if (file.type === 'folder') {
      return response
        .status(400)
        .send({ error: "A folder doesn't have content" });
    }
    const { error, code, data } = await fileTool.getFileData(file);
    if (error) return response.status(code).send({ error });
    const mimeType = mime.contentType(file.name);
    response.setHeader('Content-Type', mimeType);
    return response.status(200).send(data);
  }
}

export default FilesController;
