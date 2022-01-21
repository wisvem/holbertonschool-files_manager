import { ObjectId } from 'mongodb';
import { userTool, fileTool } from '../utils/shared';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(request, response) {
    const { userId } = await userTool.getCredentials(request);
    const user = await userTool.getUser({
      _id: ObjectId(userId),
    });
    if (!user) return response.status(401).send({ error: 'Unauthorized' });
    const { error: validationError, fileParams } = await fileTool.validateBody(
      request,
    );
    if (validationError) return response.status(400).send({ error: validationError });
    const newFile = await fileTool.saveFile(userId, fileParams, FOLDER_PATH);
    return response.status(201).send(newFile);
  }
}

export default FilesController;
