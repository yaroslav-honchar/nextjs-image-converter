"use client"

import React, { ChangeEvent, FormEvent, useRef, useState } from "react"
import prettyBytes from "pretty-bytes"
import { DataTable } from "primereact/datatable"
import { Column } from "primereact/column"
import { Button } from "primereact/button"
import { Toast } from "primereact/toast"
import { useTranslations, useLocale } from "next-intl"
import * as uuid from "uuid"
import { FormatEnum } from "sharp"
import { useToastNotify } from "@/shared/hooks"
import { MAX_FILE_SIZE, MAX_FILES_LENGTH } from "./file-upload.constants"
import { ISelectedFile } from "../types"
import { createSelectedFiles } from "../helpers"
import { useSendSelectedFiles } from "../api"
import { ConvertSelect, TableHeader } from "../components"

export const FileUpload = () => {
  const locale = useLocale()
  const tFileUpload = useTranslations("FileUpload")
  const toastRef = useRef<Toast>(null)
  const { notifyWarning } = useToastNotify(toastRef)
  const [selectedFiles, setSelectedFiles] = useState<ISelectedFile[]>([])
  const { isLoading, downloadUrls, sendFilesToConvert } = useSendSelectedFiles()

  const onFileUploadHandle = ({ target: { files } }: ChangeEvent<HTMLInputElement>): void => {
    if (!files?.length) {
      return
    }

    let newFiles: File[] = Array.from(files!).filter((file: File) => {
      const isToLarge = file.size > MAX_FILE_SIZE

      if (isToLarge) {
        notifyWarning([
          "max_size_warn",
          {
            size: prettyBytes(MAX_FILE_SIZE, { locale }),
          },
        ])
      }

      return !isToLarge
    })

    if (
      selectedFiles.length > MAX_FILES_LENGTH ||
      newFiles.length + selectedFiles.length > MAX_FILES_LENGTH
    ) {
      notifyWarning(["max_files_warn", { quantity: MAX_FILES_LENGTH }])

      newFiles = newFiles.splice(0, MAX_FILES_LENGTH - selectedFiles.length)
    }

    setSelectedFiles((prevFiles: ISelectedFile[]): ISelectedFile[] => [
      ...prevFiles,
      ...createSelectedFiles(selectedFiles, newFiles),
    ])
  }

  const onSubmitHandle = (event: FormEvent): void => {
    event.preventDefault()

    const hasNoTargetSomeFile: ISelectedFile | undefined = selectedFiles.find(
      ({ convertTarget }: ISelectedFile) => !convertTarget,
    )
    if (hasNoTargetSomeFile) {
      notifyWarning(["target_warn"])
      return
    }

    const formData: FormData = new FormData()

    selectedFiles.forEach(({ file, convertTarget }: ISelectedFile, index: number): void => {
      const id = uuid.v4()

      formData.append(`file_${id}`, file)
      formData.append(`target_${id}`, convertTarget as keyof FormatEnum)
    })

    sendFilesToConvert(formData)
  }

  const onConvertTargetChangeHandle = (
    selectedFile: ISelectedFile,
    convertTarget: keyof FormatEnum,
  ): void => {
    setSelectedFiles((prevSelectedFiles: ISelectedFile[]): ISelectedFile[] => {
      const currentSelectedFileIndex = prevSelectedFiles.findIndex(
        (prevSelectedFile: ISelectedFile): boolean => {
          return selectedFile === prevSelectedFile
        },
      )
      if (currentSelectedFileIndex < 0) {
        return prevSelectedFiles
      }

      prevSelectedFiles[currentSelectedFileIndex].convertTarget = convertTarget

      return [...prevSelectedFiles]
    })
  }

  const onFilesClearHandle = (): void => {
    setSelectedFiles([])
  }

  return (
    <form
      id={"file-upload-form"}
      className={"lg:max-w-[80vw] w-full m-auto p-10"}
      onSubmit={onSubmitHandle}
    >
      <Toast ref={toastRef} />
      <DataTable
        value={selectedFiles}
        tableStyle={{ width: "100%" }}
        header={
          <TableHeader
            isSelectFilesLocked={selectedFiles.length >= MAX_FILES_LENGTH}
            hasFiles={selectedFiles.length > 0}
            isLoading={isLoading}
            downloadUrls={downloadUrls}
            onFileUpload={onFileUploadHandle}
            onFilesClear={onFilesClearHandle}
          />
        }
      >
        <Column
          field="fileData.name"
          className={"max-w-[40vw]"}
          header={tFileUpload("file_name")}
          body={({ file }: ISelectedFile) => {
            return (
              <p className={"w-full text-ellipsis overflow-hidden white-space-nowrap"}>
                {file.name}
              </p>
            )
          }}
        />
        <Column
          field="fileData.size"
          header={tFileUpload("file_size")}
          body={({ file }: ISelectedFile) => prettyBytes(file.size, { locale })}
        />
        <Column
          field="fileData.type"
          header={tFileUpload("file_type")}
        />
        <Column
          field="convertTo"
          header={tFileUpload("convert_to")}
          body={(selectedFile: ISelectedFile) => (
            <ConvertSelect
              selectedFile={selectedFile}
              onConvertTargetChange={onConvertTargetChangeHandle}
            />
          )}
        />
        <Column
          body={() => (
            <Button
              type="button"
              icon="pi pi-times"
              className="p-button-outlined p-button-rounded p-button-danger w-8 h-8 m-auto hover:bg-red-500 hover:text-white"
            />
          )}
        />
      </DataTable>
    </form>
  )
}
