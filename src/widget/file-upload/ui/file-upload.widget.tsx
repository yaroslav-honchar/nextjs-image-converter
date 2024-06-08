"use client"

import React, { ChangeEvent, FormEvent, useRef, useState } from "react"
import prettyBytes from "pretty-bytes"
import { DataTable } from "primereact/datatable"
import { Column } from "primereact/column"
import { Button } from "primereact/button"
import { Toast } from "primereact/toast"
import { InputText } from "primereact/inputtext"
import { Checkbox } from "primereact/checkbox"
import { useTranslations, useLocale } from "next-intl"
import * as uuid from "uuid"
import { FormatEnum } from "sharp"
import { useToastNotify } from "@/shared/hooks"
import { IConvertHistoryItem, ISelectedFile } from "@/shared/types"
import { Icon } from "@/shared/components"
import { createSelectedFiles } from "../helpers"
import { useSendSelectedFiles } from "../api"
import { ConvertSelect, EmptyTemplate, TableHeader } from "../components"
import { MAX_FILE_SIZE, MAX_FILES_LENGTH } from "../constants"

export const FileUpload = () => {
  const locale = useLocale()
  const tFileUpload = useTranslations("FileUpload")
  const toastRef = useRef<Toast>(null)
  const { isLoading, convertHistory, sendFilesToConvert } = useSendSelectedFiles()
  const { notifyWarning, notifyError, notifySuccess } = useToastNotify(toastRef)
  const [selectedFiles, setSelectedFiles] = useState<ISelectedFile[]>([])
  const [isTelegramConfirmed, setIsTelegramConfirmed] = useState<boolean>(false)

  const onFileSelectHandle = ({ target: { files } }: ChangeEvent<HTMLInputElement>): void => {
    if (!files?.length) {
      return
    }

    let newFiles: File[] = Array.from(files!).filter((file: File) => {
      const isToLarge = file.size > MAX_FILE_SIZE
      const isImage = file.type.startsWith("image/")

      if (!isImage) {
        notifyWarning(["file_type_warn", { name: file.name }])

        return false
      }

      if (isToLarge) {
        notifyWarning([
          "max_size_warn",
          {
            size: prettyBytes(MAX_FILE_SIZE, { locale }),
            name: file.name,
          },
        ])

        return false
      }

      return !isToLarge && isImage
    })

    if (
      selectedFiles.length > MAX_FILES_LENGTH ||
      newFiles.length + selectedFiles.length > MAX_FILES_LENGTH
    ) {
      notifyWarning(["max_files_warn", { quantity: MAX_FILES_LENGTH }])

      newFiles = newFiles.splice(0, MAX_FILES_LENGTH - selectedFiles.length)
    }

    setSelectedFiles((prevFiles: ISelectedFile[]): ISelectedFile[] => {
      return [...prevFiles, ...createSelectedFiles(prevFiles, newFiles)]
    })
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

    selectedFiles.forEach(({ file, convertTarget }: ISelectedFile): void => {
      const id = uuid.v4()

      formData.append(`file_${id}`, file)
      formData.append(`target_${id}`, convertTarget as keyof FormatEnum)
    })

    sendFilesToConvert(formData, {
      onSuccess: (): void => {
        notifySuccess(["convert_success"])
      },
      onError: (error: Error): void => {
        notifyError(error.message)
      },
    })
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

  const onRemoveSelectedFileHandle = (selectedFile: ISelectedFile): void => {
    setSelectedFiles((prevSelectedFiles: ISelectedFile[]): ISelectedFile[] => {
      return prevSelectedFiles.filter((prevSelectedFile: ISelectedFile): boolean => {
        return prevSelectedFile !== selectedFile
      })
    })
  }

  return (
    <div className={"container flex flex-col gap-8 m-auto"}>
      <form
        id={"file-upload-form"}
        className={"w-full max-w-[61.25rem] mx-auto"}
        onSubmit={onSubmitHandle}
      >
        <Toast ref={toastRef} />
        <DataTable<ISelectedFile[]>
          value={selectedFiles}
          className={"w-full"}
          emptyMessage={<EmptyTemplate />}
          header={
            <TableHeader
              isSelectFilesLocked={selectedFiles.length >= MAX_FILES_LENGTH}
              hasFiles={selectedFiles.length > 0}
              isLoading={isLoading}
              onFileSelect={onFileSelectHandle}
              onFilesClear={onFilesClearHandle}
            />
          }
          footer={() => {
            return (
              <div className={"flex flex-col gap-2"}>
                <div className={"flex items-center gap-2"}>
                  <Checkbox
                    id={"telegram_confirm"}
                    name={"telegram_confirm"}
                    checked={isTelegramConfirmed}
                    onChange={() => setIsTelegramConfirmed((prevState: boolean) => !prevState)}
                  />
                  <label htmlFor="telegram_confirm">Send converted archives to Telegram</label>
                </div>
                <InputText
                  className={"w-60"}
                  placeholder={"Telegram @username"}
                  disabled={!isTelegramConfirmed}
                />
              </div>
            )
          }}
        >
          <Column
            field={"file.name"}
            className={"max-w-[40vw]"}
            header={tFileUpload("file_name")}
            body={({ file }: ISelectedFile) => {
              return (
                <p className={"w-full text-ellipsis overflow-hidden whitespace-nowrap"}>
                  {file.name}
                </p>
              )
            }}
            footer={<p className={"whitespace-nowrap"}>{tFileUpload("total_size")}</p>}
          />
          <Column
            field={"file.size"}
            header={tFileUpload("file_size")}
            body={({ file }: ISelectedFile) => (
              <p className={"whitespace-nowrap"}>{prettyBytes(file.size, { locale })}</p>
            )}
            footer={prettyBytes(
              selectedFiles.reduce((acc, item) => acc + item.file.size, 0),
              { locale },
            )}
          />
          <Column
            field={"file.type"}
            header={tFileUpload("file_type")}
          />
          <Column
            field={"convertTarget"}
            header={tFileUpload("convert_to")}
            body={(selectedFile: ISelectedFile) => (
              <ConvertSelect
                selectedFile={selectedFile}
                onConvertTargetChange={onConvertTargetChangeHandle}
              />
            )}
          />
          <Column
            body={(selectedFile: ISelectedFile) => (
              <Button
                type="button"
                icon={<Icon name={"trash"} />}
                severity={"danger"}
                onClick={() => onRemoveSelectedFileHandle(selectedFile)}
              />
            )}
          />
        </DataTable>
      </form>
      {convertHistory.length > 0 && (
        <DataTable<IConvertHistoryItem[]>
          value={convertHistory}
          tableStyle={{ width: "100%" }}
          className={"w-full max-w-[61.25rem] mx-auto"}
          header={<h2 className={"text-xl font-bold"}>{tFileUpload("convert_history")}</h2>}
        >
          <Column
            field={"name"}
            className={"max-w-[40vw]"}
            header={tFileUpload("file_name")}
            body={({ name }: IConvertHistoryItem) => {
              return (
                <p className={"w-full text-ellipsis overflow-hidden whitespace-nowrap"}>{name}</p>
              )
            }}
            footer={<p className={"whitespace-nowrap"}>{tFileUpload("total_size")}</p>}
          />
          <Column
            field={"size"}
            className={"max-w-[40vw]"}
            header={tFileUpload("file_size")}
            body={({ size }: IConvertHistoryItem) => {
              return <p className={"w-full whitespace-nowrap"}>{prettyBytes(size, { locale })}</p>
            }}
            footer={prettyBytes(
              convertHistory.reduce((acc, item) => acc + item.size, 0),
              { locale },
            )}
          />
          <Column
            field={"convertedTime"}
            header={tFileUpload("converted_time")}
            className={"max-w-[40vw]"}
            body={({ convertedTime }: IConvertHistoryItem) => {
              return <p>{convertedTime}</p>
            }}
          />
          <Column
            field={"url"}
            className={"max-w-[40vw]"}
            body={({ url }: IConvertHistoryItem) => {
              return (
                <Button
                  rel={"noreferrer nofollow"}
                  icon={"pi pi-download"}
                  className={"m-auto"}
                  onClick={() => window.open(url, "_blank", "nofollow noreferrer")}
                />
              )
            }}
          />
        </DataTable>
      )}
    </div>
  )
}
